import { NextResponse } from "next/server";
import {
  CF_TEXT_MISSING_CREDS,
  hasCfTextCreds,
  runCfText,
} from "@/lib/cf-text";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type NoteGenerateBody = {
  title?: string;
  angle?: string;
  format?: string;
  pillar?: string;
  materials?: string[];
  persona?: {
    name?: string;
    age?: number;
    gender?: string;
    stage?: string;
    voice?: string;
    audience?: string;
    background?: string;
    contentMix?: string;
  };
  extraNote?: string;
  previousBody?: string;
};

function cleanMaterials(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!t || t.length < 2) continue;
    if (out.some((x) => x === t)) continue;
    out.push(t.slice(0, 500));
    if (out.length >= 8) break;
  }
  return out;
}

function formatRule(format: string, contentMix: string): string {
  if (format === "tips") {
    return "8. 结构：开头一句点题 → 3～4 条可执行做法（每条一两句）→ 一句收尾。";
  }
  if (contentMix === "life") {
    return "8. 结构：当天具体场景或物件 → 实际怎么过的 → 一句真实感受，不要升华成人生宣言。";
  }
  if (format === "emotion") {
    return "8. 结构：先写此刻状态和具体发生 → 落到一个可核对的细节 → 轻轻给一个出口，不要文学比喻。";
  }
  return "8. 结构：当下状态（天数、投递、消息、心情）→ 具体发生了什么 → 若素材里有项目/动作就写开 → 一句收住。";
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

  if (!hasCfTextCreds()) {
    return NextResponse.json({ error: CF_TEXT_MISSING_CREDS }, { status: 503 });
  }

  const title = String(input.title || "").trim().slice(0, 80);
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const materials = cleanMaterials(
    Array.isArray(input.materials) ? input.materials.map(String) : [],
  );
  const angle = String(input.angle || "").trim().slice(0, 160);
  const format = String(input.format || "story").trim();
  const contentMix = String(input.persona?.contentMix || "").trim();
  const name = String(input.persona?.name || "").trim().slice(0, 40);
  const age = Number(input.persona?.age) || 0;
  const gender = String(input.persona?.gender || "").trim().slice(0, 8);
  const stage = String(input.persona?.stage || "").trim().slice(0, 80);
  const voice = String(input.persona?.voice || "").trim().slice(0, 120);
  const audience = String(input.persona?.audience || "").trim().slice(0, 80);
  const background = String(input.persona?.background || "").trim().slice(0, 80);
  const extra = String(input.extraNote || "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, 2000);
  const previousBody = String(input.previousBody || "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, 2500);

  const system = [
    "你是小红书博主，用第一人称写能直接发的日记体正文。",
    "硬性规则：",
    "1. 只输出正文，不要标题、不要话题标签、不要解释。",
    "2. 短句、频繁换行，一段一两句，段与段空一行。像自己打字，不像小作文。",
    "3. 【补充当下情况】和【灵感素材】是必用事实，每次生成（含重新生成）都必须写进正文：数字、天数、项目名、岗位地点、猎头、已读不回。项目要写清做什么、解决什么问题，不要改名，不要删，不要「点到为止」。",
    "4. 没有写过的经历、项目、对话、数量、时间不要编。素材少时就写眼前能核对的动作，不要用船、深海、被抛弃、海浪这类文学隐喻。",
    "5. 禁止空话：坚持不懈、不可思议、赋能、底层逻辑、一定要加油。规划黑话也不要：变量、节律、耗竭、复盘清单。",
    "6. 必须写满 550～900 字，用完整句子，不要一行两三个词的提纲。专有名词可保留英文（AI Agent、PM、JD）。可用 0～3 个 emoji 做小节标记（如 💡✨），不要堆。",
    "7. 若给了上一版正文：换开头和段落顺序，但【补充当下情况】【灵感素材】以及上一版里已经用上的这些事实，一条都不能丢。",
    formatRule(format, contentMix),
    "节奏参考（只学换行和具体，不要抄情节，更不要用下面的情节替换用户事实）：",
    "又过了一周，投递还是这个节奏。",
    "已读不回很常见，主动来的岗位匹配度也不高。",
    "偶尔会闷一下，但当天该发的简历还是发完了。",
    "",
    "空档期没有空着。",
    "把正在做的项目又推进了一版，把能写进简历的结果记下来。",
    "",
    "慢慢来，先把这件事做完整。",
  ].join("\n");

  const user = [
    extra
      ? `【必用事实·补充当下情况】必须全部写进正文，重新生成时也不得删减：\n${extra}`
      : "",
    materials.length
      ? `【必用事实·灵感素材】必须写进正文，不要改名、不要省略：\n${materials.join("\n---\n")}`
      : "【必用事实·灵感素材】无",
    `标题：${title}`,
    angle ? `写作角度：${angle}` : "",
    name ? `人设：${name}` : "",
    age ? `年龄：${age}` : "",
    gender ? `性别：${gender}` : "",
    background ? `背景：${background}` : "",
    stage ? `阶段：${stage}` : "",
    voice ? `语气：${voice}` : "",
    audience ? `读者：${audience}` : "",
    previousBody
      ? `上一版正文（请换一种叙述；上面的补充和灵感事实必须保留）：\n${previousBody}`
      : "",
    extra || materials.length
      ? "请直接写正文。补充当下情况和灵感素材里的事实必须全部用上，不要因为重写而丢掉。"
      : "请直接写正文。",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, model } = await runCfText({
      system,
      user,
      maxTokens: 1800,
      temperature: 0.75,
    });

    if (text.replace(/\s/g, "").length < 220) {
      return NextResponse.json({ error: "模型返回过短" }, { status: 502 });
    }

    return NextResponse.json({ body: text, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "生成失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
