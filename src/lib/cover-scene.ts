import { normalizePresetId, type ContentMix } from "@/lib/persona";

export type CoverDistillInput = {
  title?: string;
  body?: string;
  angle?: string;
  /** What the user typed in the cover prompt box (may be empty). */
  userPrompt?: string;
  presetId?: string;
  contentMix?: string;
  format?: string;
  personaName?: string;
  background?: string;
  audience?: string;
  stage?: string;
  voice?: string;
};

type Rule = { test: RegExp; value: string };

const SCENE_RULES: Rule[] = [
  {
    test: /通勤妆|地铁妆|出门妆|五分钟.*妆|妆步骤/,
    value:
      "commute makeup kit, train window ledge, compact powder, eyeliner, lipstick, smartphone timer, morning light",
  },
  {
    test: /空瓶|回购|贵妇/,
    value: "empty skincare bottles, used makeup bottles, wooden vanity still life",
  },
  {
    test: /试色|口红|唇釉|唇膏|踩雷/,
    value: "lipstick swatches on paper, lip tubes, warm indoor light, product close-up",
  },
  {
    test: /眼线|画飘/,
    value: "eyeliner pen, cotton swabs, small mirror, bathroom shelf, messy makeup station",
  },
  {
    test: /眼影|这一盘/,
    value: "open eyeshadow palette, fluffy brush, vanity, soft daylight",
  },
  {
    test: /底妆|卡粉|脱妆/,
    value: "foundation bottle, beauty sponge, powder compact, clean vanity, daylight",
  },
  {
    test: /卸妆|敏感肌|护肤|素颜/,
    value: "skincare bottles, cotton pad, bathroom sink, water droplets, quiet morning",
  },
  {
    test: /眉毛|修容/,
    value: "brow pencil, spoolie, tiny mirror, product close-up",
  },
  {
    test: /约会妆|日常妆/,
    value: "two makeup pouches, daily kit vs evening kit, vanity top",
  },
  {
    test: /刷子|清洁/,
    value: "makeup brushes in a cup, soapy sink, bathroom still life",
  },
  {
    test: /收纳|桌面|阳台|小户型|软装/,
    value: "small apartment corner, plants, linen, warm lamp, lived-in calm",
  },
  {
    test: /油耗|停车|车内|试驾|开车/,
    value: "car interior, keys, coffee cup in holder, dashboard, daylight, no driver",
  },
  {
    test: /简历|投递|STAR|岗位/,
    value: "printed resume, laptop, coffee, quiet desk, window light, no person",
  },
  {
    test: /面试/,
    value: "notebook, water glass, earphones, cafe table, calm interview-day still life",
  },
  {
    test: /做饭|家常|下厨|探店/,
    value: "home-cooked food, steam, everyday crockery, warm kitchen light",
  },
];

const OBJECT_RULES: Rule[] = [
  { test: /口红|唇/, value: "lipstick" },
  { test: /眼线/, value: "eyeliner pen" },
  { test: /眼影/, value: "eyeshadow palette" },
  { test: /底妆|粉底/, value: "foundation bottle" },
  { test: /粉扑|美妆蛋/, value: "makeup sponge" },
  { test: /空瓶/, value: "empty product bottles" },
  { test: /刷子/, value: "makeup brushes" },
  { test: /镜子/, value: "compact mirror" },
  { test: /通勤|地铁|公交/, value: "transit window and tote bag" },
  { test: /手机/, value: "smartphone" },
  { test: /简历/, value: "printed resume" },
  { test: /笔记本|电脑/, value: "laptop" },
  { test: /咖啡/, value: "coffee cup" },
  { test: /植物|阳台/, value: "indoor plants" },
  { test: /钥匙/, value: "car keys" },
];

const STYLE_RULES: Rule[] = [
  { test: /简洁|极简|简约/, value: "minimal clean composition" },
  { test: /浅紫|淡紫|紫色/, value: "soft lavender tones" },
  { test: /暖色|珊瑚|橙色/, value: "warm coral accents" },
  { test: /冷色|蓝色/, value: "cool blue tones" },
  { test: /扁平|插画/, value: "flat illustration, not a photo" },
  { test: /摄影|写实|写真/, value: "photorealistic photography" },
  { test: /浅景深|特写/, value: "shallow depth of field, close-up" },
  { test: /自然光|窗光/, value: "soft natural window light" },
];

function sourceText(input: CoverDistillInput): string {
  return [
    input.userPrompt,
    input.personaName,
    input.background,
    input.audience,
    input.stage,
    input.title,
    input.angle,
    input.body,
  ]
    .map((s) => s?.trim() || "")
    .filter(Boolean)
    .join("\n");
}

/** Old client dumps Chinese title/body into the prompt; treat that as empty. */
export function normalizeUserCoverPrompt(raw?: string): string {
  const t = raw?.trim() || "";
  if (!t) return "";
  if (
    /^Xiaohongshu vertical cover/i.test(t) &&
    /title:|body cues:|theme:/i.test(t)
  ) {
    return "";
  }
  return t;
}

export function coverPromptHasHeavyCjk(text: string): boolean {
  const chars = text.replace(/\s/g, "");
  if (!chars) return false;
  const cjk = (chars.match(/[\u3400-\u9fff]/g) || []).length;
  return cjk / chars.length > 0.18;
}

function defaultScene(presetId?: string, contentMix?: string): string {
  const preset = normalizePresetId(presetId);
  const mix = (contentMix || "") as ContentMix;
  if (preset === "beauty") {
    return "everyday makeup still life, small vanity, soft daylight";
  }
  if (preset === "home") {
    return "small home corner, plants, linen, warm lamp";
  }
  if (preset === "auto") {
    return "car interior still life, keys, coffee cup, daylight, no driver";
  }
  if (preset === "resign" || mix === "job") {
    return "desk still life, papers, laptop, window light, no person";
  }
  if (preset === "career-daily" || mix === "career") {
    return "office desk still life, notebook, tea, no person";
  }
  return "everyday lifestyle still life, warm paper tones, no person";
}

function collectHits(rules: Rule[], text: string): string[] {
  const hits: string[] = [];
  for (const rule of rules) {
    if (!rule.test.test(text)) continue;
    if (rule.value && !hits.includes(rule.value)) hits.push(rule.value);
  }
  return hits;
}

function translateUserBits(userPrompt: string): string {
  if (!userPrompt) return "";
  const styles = collectHits(STYLE_RULES, userPrompt);
  const objects = collectHits(OBJECT_RULES, userPrompt);
  const scenes = collectHits(SCENE_RULES, userPrompt);
  const latin = userPrompt
    .replace(/[\u3400-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...scenes.slice(0, 1), ...objects.slice(0, 4), ...styles, latin]
    .filter(Boolean)
    .join(", ");
}

function uniqueKeywords(parts: Array<string | null | undefined>): string {
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
  return out.join(", ").slice(0, 700);
}

/**
 * Turn title + body + optional user notes into English keywords for Flux T2I.
 * Flux-1-schnell is text-to-image only: it reads English tags, not Chinese copy.
 */
export function distillCoverVisualPrompt(input: CoverDistillInput): string {
  const userPrompt = normalizeUserCoverPrompt(input.userPrompt);
  const topicText = [
    input.personaName,
    input.background,
    input.audience,
    input.title,
    input.angle,
    input.body,
  ]
    .map((s) => s?.trim() || "")
    .filter(Boolean)
    .join("\n");
  const all = sourceText({ ...input, userPrompt });

  const topicScenes = collectHits(SCENE_RULES, topicText);
  const userScenes = collectHits(SCENE_RULES, userPrompt);
  const objects = collectHits(OBJECT_RULES, all).slice(0, 5);
  const styles = collectHits(STYLE_RULES, all);
  const userBits = translateUserBits(userPrompt);

  const scene =
    userScenes[0] ||
    topicScenes[0] ||
    defaultScene(input.presetId, input.contentMix);

  const wantsPerson = /人像|人物|自拍|模特|肖像|selfie|portrait/i.test(
    userPrompt,
  );

  return uniqueKeywords([
    userBits,
    scene,
    objects.join(", "),
    styles.join(", "),
    "photorealistic still life",
    "vertical 3:4 cover",
    "natural window light",
    "warm beige",
    "soft coral accent",
    "shallow depth of field",
    wantsPerson ? "hands only, correct anatomy, no face close-up" : "no people, no faces, no headless figure",
    "no text, no letters, no Chinese characters, no watermark, no logo",
  ]);
}

export function resolveCoverVisualPrompt(
  input: CoverDistillInput & { prompt?: string },
): string {
  const userPrompt = normalizeUserCoverPrompt(input.userPrompt || input.prompt);
  const hasTopic = Boolean(input.title?.trim() || input.body?.trim());
  const raw = (input.prompt || "").trim();

  if (hasTopic || userPrompt) {
    return distillCoverVisualPrompt({ ...input, userPrompt });
  }
  if (raw && !coverPromptHasHeavyCjk(raw)) return raw;
  return distillCoverVisualPrompt({
    ...input,
    userPrompt,
    title: input.title || raw,
  });
}
