import {
  parseCoverBrief,
  type CoverBrief,
} from "@/lib/cover-compose";

/** Kolors is bilingual; keep 3:4 still-life constraints and never paint cover copy. */
export function buildCoverImagePrompt(raw: string): string {
  const text = raw.trim().slice(0, 900);
  const brief = parseCoverBrief(text);

  if (brief.wantsText) {
    return uniqueJoin([
      "抽象留白背景",
      "竖版 3:4 封面",
      "中心大面积空白",
      "不要人物",
      "不要脸",
      "不要文字",
      "不要数字",
      "不要 logo",
      brief.color || "柔和低饱和配色",
      "纸质纹理",
    ]);
  }

  return uniqueJoin([
    text,
    "写实静物",
    "竖版 3:4",
    "不要文字",
    "不要字母",
    "不要汉字",
    "不要水印",
    "不要 logo",
  ]);
}

function uniqueJoin(parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const token of part.split(",")) {
      const t = token.replace(/\s+/g, " ").trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out.join(", ");
}

export function shouldComposeTextLocally(prompt: string): boolean {
  return parseCoverBrief(prompt).wantsText;
}

export function getCoverBrief(prompt: string): CoverBrief {
  return parseCoverBrief(prompt);
}
