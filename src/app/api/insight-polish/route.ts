import { NextResponse } from "next/server";
import {
  CF_TEXT_MISSING_CREDS,
  hasCfTextCreds,
  runCfText,
} from "@/lib/cf-text";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = {
  raw?: string;
  pillar?: string;
  persona?: {
    name?: string;
    voice?: string;
    audience?: string;
    background?: string;
  };
};

export async function POST(req: Request) {
  const gate = await requireUserForAi(req);
  if (!gate.ok) return gate.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!hasCfTextCreds()) {
    return NextResponse.json({ error: CF_TEXT_MISSING_CREDS }, { status: 503 });
  }

  const raw = String(input.raw || "").trim().slice(0, 1500);
  if (raw.length < 8) {
    return NextResponse.json({ error: "原文太短" }, { status: 400 });
  }

  const name = String(input.persona?.name || "").trim().slice(0, 40);
  const voice = String(input.persona?.voice || "").trim().slice(0, 120);
  const audience = String(input.persona?.audience || "").trim().slice(0, 80);
  const background = String(input.persona?.background || "").trim().slice(0, 80);
  const pillar = String(input.pillar || "").trim().slice(0, 20);

  const system = [
    "你是小红书灵感润色编辑，把用户随手记的原话改写成可直接进笔记的口语片段。",
    "硬性规则：",
    "1. 只输出润色后的正文，不要标题、标签、解释、前后缀。",
    "2. 必须改写措辞和节奏，禁止只加换行或把长句拆成原词短句。",
    "3. 保留全部关键事实（数字、项目名、动作、身份），不要编造原文没有的经历、时间或细节。",
    "4. 「近期」「最近」保持原样，不要改成上周末、昨天等更具体的时间。",
    "5. 删掉口头禅和空话（其实、就是、进行了、全过程），换成具体、好读的说法。",
    "6. 像跟熟人说话：短句、一句抓人的开头、分段空一行。",
    "7. 不要鸡汤、口号、赋能、底层逻辑、一定要加油。",
    "8. 长度约为原文的 0.9～1.3 倍，不要扩写成完整笔记。专有名词可保留英文。",
  ].join("\n");

  const user = [
    name ? `人设：${name}` : "",
    background ? `背景：${background}` : "",
    voice ? `语气：${voice}` : "",
    audience ? `读者：${audience}` : "",
    pillar ? `内容支柱：${pillar}` : "",
    "原文：",
    raw,
    "请直接输出润色后的正文。",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, model } = await runCfText({
      system,
      user,
      maxTokens: 700,
      temperature: 0.6,
    });

    const compact = (s: string) => s.replace(/[\s。！？，,、；;：:\n]/g, "");
    if (!text || compact(text).length < 8) {
      return NextResponse.json({ error: "模型返回过短" }, { status: 502 });
    }
    if (compact(text) === compact(raw)) {
      return NextResponse.json({ error: "润色无改写" }, { status: 502 });
    }

    return NextResponse.json({ polished: text, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "润色失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
