import { hasCfTextCreds, runCfText } from "@/lib/cf-text";
import type { CoverDistillInput } from "@/lib/cover-scene";

function clip(value: string | undefined, max: number): string {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeVisualPrompt(raw: string): string {
  let text = raw
    .trim()
    .replace(/^```[\w]*\s*|\s*```$/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(prompt|关键词|提示词)\s*[:=：]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 12) return "";
  if (!/不要文字|no text/i.test(text)) {
    text += "，不要文字，不要水印，不要 logo";
  }
  if (!/不要人物|不要脸|no people|no faces/i.test(text)) {
    text += "，不要人物，不要脸";
  }
  return text.slice(0, 700);
}

/**
 * Distill persona + title + body into a Chinese visual prompt for Kolors.
 * Uses the site text model (same CLOUDFLARE_* as note writing). Returns null on failure.
 */
export async function distillCoverPromptWithLlm(
  input: CoverDistillInput,
): Promise<string | null> {
  if (!hasCfTextCreds()) return null;

  const title = clip(input.title, 80);
  const body = clip(input.body, 420);
  if (!title && !body && !clip(input.userPrompt, 80)) return null;

  const system = [
    "你为快手 Kolors 写中文生图提示词。",
    "只提取画面里能看见的东西：物品、场景、光线、材质、颜色。",
    "输出一行中文短语，用逗号或顿号分隔。不要解释，不要标题原文。",
    "必须包含：写实静物，竖版 3:4 小红书封面，自然光。",
    "必须包含：不要人物，不要脸，不要文字，不要水印。",
    "不要画抽象情绪，把情绪换成具体物件。",
  ].join("");

  const user = [
    input.personaName ? `人设：${clip(input.personaName, 40)}` : "",
    input.background ? `领域：${clip(input.background, 40)}` : "",
    input.stage ? `阶段：${clip(input.stage, 40)}` : "",
    input.audience ? `读者：${clip(input.audience, 40)}` : "",
    input.voice ? `语气：${clip(input.voice, 40)}` : "",
    input.presetId ? `方向：${input.presetId}` : "",
    title ? `标题：${title}` : "",
    input.angle ? `角度：${clip(input.angle, 80)}` : "",
    body ? `正文：${body}` : "",
    "中文画面提示词：",
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const { text } = await runCfText({
      system,
      user,
      maxTokens: 180,
      temperature: 0.2,
      signal: controller.signal,
    });
    const cleaned = sanitizeVisualPrompt(text);
    if (!cleaned) return null;
    return cleaned;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
