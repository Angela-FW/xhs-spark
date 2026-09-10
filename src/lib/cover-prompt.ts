import {
  parseCoverBrief,
  type CoverBrief,
} from "@/lib/cover-compose";

/** Flux-1-schnell understands English far better than Chinese. */
export function buildFluxPrompt(raw: string): string {
  const text = raw.trim().slice(0, 1800);
  const brief = parseCoverBrief(text);
  const wantsPerson =
    /人像|人物|女人|男生|女生|自拍|模特|脸|肖像|portrait|woman|man|person|face|selfie/i.test(
      text,
    );
  const styleHints = translateStyleHints(text);

  // When user wants readable Chinese text, only ask Flux for a blank styled background.
  // Actual glyphs are composited locally (Flux cannot paint CJK reliably).
  if (brief.wantsText) {
    return [
      "Abstract minimal background only for a vertical 3:4 social cover.",
      "Soft empty space in the center for later typography.",
      "No people, no faces, no letters, no numbers, no logos, no UI.",
      styleHints ? `Style keywords: ${styleHints}.` : "minimal clean soft tones",
      brief.color ? `Color mood: ${brief.color}.` : null,
      "Subtle paper texture OK, keep it very simple.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const parts = [
    "Create one image that strictly follows the brief below.",
    "Match the requested content, style, and colors closely.",
    brief.wantsText
      ? null
      : "No text, letters, watermark, logo, or UI chrome in the image.",
    "Vertical 3:4 cover composition.",
    wantsPerson
      ? null
      : "Do not include any person, face, or portrait unless the brief asks for it.",
    styleHints ? `Style keywords: ${styleHints}.` : null,
    `Brief:\n${text}`,
  ].filter(Boolean);
  return parts.join(" ");
}

export function shouldComposeTextLocally(prompt: string): boolean {
  return parseCoverBrief(prompt).wantsText;
}

export function getCoverBrief(prompt: string): CoverBrief {
  return parseCoverBrief(prompt);
}

function translateStyleHints(text: string): string {
  const map: [RegExp, string][] = [
    [/简洁|极简|简约/, "minimal clean simple"],
    [/浅紫|淡紫|紫色/, "light lavender soft purple"],
    [/素色|素净|清淡/, "muted plain soft tones"],
    [/扁平|插画|扁平风/, "flat illustration vector"],
    [/信息图|数据|图表/, "infographic clean data visualization"],
    [/商务|职场|简历|面试|沟通/, "professional business career"],
    [/暖色|珊瑚|橙色/, "warm coral accents"],
    [/冷色|蓝色/, "cool blue tones"],
    [/摄影|写实/, "photorealistic photography"],
    [/卡通|可爱/, "cute cartoon"],
  ];
  const hits: string[] = [];
  for (const [re, en] of map) {
    if (re.test(text) && !hits.includes(en)) hits.push(en);
  }
  return hits.join(", ");
}
