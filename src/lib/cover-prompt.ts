import {
  parseCoverBrief,
  type CoverBrief,
} from "@/lib/cover-compose";

/** Flux-1-schnell understands English far better than Chinese. */
export function buildFluxPrompt(raw: string): string {
  const text = raw.trim().slice(0, 900);
  const brief = parseCoverBrief(text);

  if (brief.wantsText) {
    return uniqueJoin([
      "abstract minimal background",
      "vertical 3:4 cover",
      "empty center space",
      "no people",
      "no faces",
      "no letters",
      "no numbers",
      "no logos",
      brief.color || "soft muted tones",
      "paper texture",
    ]);
  }

  return uniqueJoin([
    text,
    "photorealistic",
    "vertical 3:4",
    "no text",
    "no letters",
    "no Chinese characters",
    "no watermark",
    "no logo",
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
