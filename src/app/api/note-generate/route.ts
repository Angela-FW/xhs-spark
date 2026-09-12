import { NextResponse } from "next/server";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

type NoteGenerateBody = {
  title?: string;
  angle?: string;
  format?: string;
  pillar?: string;
  materials?: string[];
  persona?: {
    stage?: string;
    voice?: string;
    audience?: string;
    background?: string;
  };
  extraNote?: string;
};

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

/** Text AI always uses the shared site Cloudflare Workers AI credentials. */
function resolveTextCfCreds(): { id: string; token: string } {
  return {
    id: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "",
    token: process.env.CLOUDFLARE_API_TOKEN?.trim() || "",
  };
}

function cleanMaterials(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || t.length < 2) continue;
    if (out.some((x) => x === t || x.includes(t) || t.includes(x))) continue;
    out.push(t.slice(0, 80));
    if (out.length >= 6) break;
  }
  return out;
}

export async function POST(req: Request) {
  const gate = await requireUserForAi(req);
  if (!gate.ok) return gate.response;

  let input: NoteGenerateBody;
  try {
    input = (await req.json()) as NoteGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, token } = resolveTextCfCreds();
  if (!id || !token) {
    return NextResponse.json(
      {
        error:
          "服务端未配置文生模型（缺少 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN）",
      },
      { status: 503 },
    );
  }

  const title = String(input.title || "").trim().slice(0, 80);
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const materials = cleanMaterials(
    Array.isArray(input.materials) ? input.materials.map(String) : [],
  );
  const angle = String(input.angle || "").trim().slice(0, 120);
  const format = String(input.format || "story").trim();
  const stage = String(input.persona?.stage || "").trim().slice(0, 40);
  const voice = String(input.persona?.voice || "").trim().slice(0, 40);
  const audience = String(input.persona?.audience || "").trim().slice(0, 60);
  const background = String(input.persona?.background || "").trim().slice(0, 40);
  const extra = String(input.extraNote || "").trim().slice(0, 200);

  const system = [
    "你是小红书博主，写通顺口语中文正文。",
    "硬性规则：",
    "1. 只输出正文，不要标题、不要标签、不要解释、不要英文。",
    "2. 不要规划黑话：变量、形容词、无效的做法、节律、耗竭、防耗竭、复盘清单。",
    "3. 不要重复同一句或同一素材；素材只点到为止。",
    "4. 分段留空行；总共 180～320 字。",
    "5. 像朋友聊天，具体一点，少口号。",
    format === "tips"
      ? "6. 结构：开头一句点题 → 3～4 条可执行做法（每条一两句）→ 一句收尾。"
      : format === "emotion"
        ? "6. 结构：先讲感受 → 落到一个具体场景 → 轻轻给一个出口。"
        : "6. 结构：一个小场景开头 → 中间发生了什么 → 一句自己的看法收尾。",
  ].join("\n");

  const user = [
    `标题：${title}`,
    angle ? `主题角度：${angle}` : "",
    background ? `背景：${background}` : "",
    stage ? `阶段：${stage}` : "",
    voice ? `语气：${voice}` : "",
    audience ? `读者：${audience}` : "",
    materials.length ? `可用素材（可选用，勿全抄）：${materials.join("；")}` : "",
    extra ? `补充：${extra}` : "",
    "请直接写正文。",
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
      max_tokens: 700,
      temperature: 0.7,
    }),
  });

  const data = (await upstream.json().catch(() => null)) as {
    success?: boolean;
    result?: { response?: string };
    errors?: Array<{ message?: string }>;
  } | null;

  if (!upstream.ok || !data?.success) {
    const msg =
      data?.errors?.[0]?.message ||
      `Cloudflare text API ${upstream.status}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let body = String(data.result?.response || "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/^标题[：:].*\n+/m, "")
    .replace(/^正文[：:]\s*/m, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!body || body.length < 40) {
    return NextResponse.json({ error: "模型返回过短" }, { status: 502 });
  }

  return NextResponse.json({
    body,
    model: MODEL,
  });
}
