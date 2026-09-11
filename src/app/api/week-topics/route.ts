import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/cloud-env";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

type TopicIn = {
  id: string;
  pillar?: string;
  format?: string;
  phase?: number;
};

type Body = {
  persona?: {
    name?: string;
    age?: number;
    stage?: string;
    voice?: string;
    audience?: string;
    background?: string;
  };
  posts?: TopicIn[];
  usedTitles?: string[];
  cloudflareAccountId?: string;
  cloudflareToken?: string;
};

function resolveCfCreds(
  req: Request,
  input: Body,
): { id: string; token: string } {
  const id =
    input.cloudflareAccountId?.trim() ||
    req.headers.get("x-cloudflare-account-id")?.trim() ||
    (!isAuthConfigured()
      ? process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || ""
      : "");
  const token =
    input.cloudflareToken?.trim() ||
    req.headers.get("x-cloudflare-token")?.trim() ||
    (!isAuthConfigured()
      ? process.env.CLOUDFLARE_API_TOKEN?.trim() || ""
      : "");
  return { id, token };
}

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("模型未返回 JSON 数组");
  }
}

export async function POST(req: Request) {
  const gate = await requireUserForAi(req);
  if (!gate.ok) return gate.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, token } = resolveCfCreds(req, input);
  if (!id || !token) {
    return NextResponse.json(
      {
        error: isAuthConfigured()
          ? "缺少你自己的 Cloudflare Key：请在生成页配置 Account ID 与 API Token（登录后会同步到账号）。"
          : "缺少 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN。本地写在 .env.local，或在生成页填写个人 Key。",
      },
      { status: 400 },
    );
  }

  const posts = Array.isArray(input.posts) ? input.posts.slice(0, 4) : [];
  if (!posts.length) {
    return NextResponse.json({ error: "需要 posts" }, { status: 400 });
  }

  const usedTitles = (input.usedTitles || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 40);
  const persona = input.persona || {};

  const system = [
    "你是小红书内容策划助手。",
    "根据创作者人设，为「未来最近一周」每条待写笔记生成选题。",
    "硬性规则：",
    "1. 只输出 JSON 数组，不要 markdown，不要解释。",
    '2. 每项格式：{"id":"...","titleHint":"...","angle":"..."}',
    "3. titleHint：中文标题灵感，16～28 字，像真人会点开的小红书标题，可含｜。",
    "4. angle：一句具体写作角度，20～40 字，口语、可执行，不要空话。",
    "5. 标题之间不要重复，也不要和「已用标题」撞车。",
    "6. 贴合人设年龄/背景/阶段；求职与生活可穿插，但要像同一个人写的。",
  ].join("\n");

  const user = [
    `人设名：${persona.name || "创作者"}`,
    persona.age ? `年龄：${persona.age}` : "",
    persona.background ? `背景：${persona.background}` : "",
    persona.stage ? `阶段：${persona.stage}` : "",
    persona.voice ? `语气：${String(persona.voice).slice(0, 80)}` : "",
    persona.audience ? `读者：${persona.audience}` : "",
    usedTitles.length
      ? `已用标题（勿重复）：${usedTitles.join(" ｜ ")}`
      : "已用标题：无",
    "待生成条目：",
    ...posts.map(
      (p, i) =>
        `${i + 1}. id=${p.id}; pillar=${p.pillar || ""}; format=${p.format || "story"}; phase=${p.phase ?? ""}`,
    ),
    `请输出长度为 ${posts.length} 的 JSON 数组，id 必须与上面一致。`,
  ]
    .filter(Boolean)
    .join("\n");

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${MODEL}`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 900,
      temperature: 0.75,
    }),
  });

  const data = (await upstream.json().catch(() => null)) as {
    success?: boolean;
    result?: { response?: string };
    errors?: Array<{ message?: string }>;
  } | null;

  if (!upstream.ok || !data?.success) {
    const msg =
      data?.errors?.[0]?.message || `Cloudflare text API ${upstream.status}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const raw = String(data.result?.response || "").trim();
  let parsed: unknown;
  try {
    parsed = extractJsonArray(raw);
  } catch {
    return NextResponse.json({ error: "模型返回无法解析" }, { status: 502 });
  }

  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: "模型返回不是数组" }, { status: 502 });
  }

  const byId = new Map<string, { titleHint: string; angle: string }>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      id?: string;
      titleHint?: string;
      title?: string;
      angle?: string;
    };
    const topicId = String(row.id || "").trim();
    const titleHint = String(row.titleHint || row.title || "")
      .trim()
      .slice(0, 40);
    const angle = String(row.angle || "")
      .trim()
      .slice(0, 80);
    if (!topicId || !titleHint || !angle) continue;
    byId.set(topicId, { titleHint, angle });
  }

  const topics = posts.map((p) => {
    const hit = byId.get(p.id);
    return {
      id: p.id,
      titleHint: hit?.titleHint || "",
      angle: hit?.angle || "",
    };
  });

  if (!topics.some((t) => t.titleHint && t.angle)) {
    return NextResponse.json({ error: "模型未生成有效选题" }, { status: 502 });
  }

  return NextResponse.json({ topics, model: MODEL });
}
