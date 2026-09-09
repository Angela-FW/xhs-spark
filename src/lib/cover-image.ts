import type { CalendarPost } from "./year-calendar";
import { pillarLabel } from "./persona";

/** Xiaohongshu-ish cover ratio */
const WIDTH = 1080;
const HEIGHT = 1440;

export function buildCoverPrompt(post: CalendarPost): string {
  const mood =
    post.format === "tips"
      ? "clean editorial flat lay notebook checklist"
      : post.format === "emotion"
        ? "soft natural window light candid lifestyle photo"
        : "documentary style authentic lifestyle photography";

  return [
    "Xiaohongshu cover image, vertical 3:4",
    "Chinese woman in her late 30s job seeking life restart theme",
    `topic: ${post.titleHint}`,
    `pillar: ${pillarLabel(post.pillar)}`,
    mood,
    "warm paper tones, coral accent, no purple neon, no text overlay, no watermark, no logo",
    "realistic, tasteful, not stock-photo smile",
  ].join(", ");
}

export function buildCoverImageUrl(
  post: CalendarPost,
  options?: { seed?: number; key?: string },
): string {
  const prompt = buildCoverPrompt(post);
  const seed = options?.seed ?? hashSeed(post.id);
  const params = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    model: "flux",
    seed: String(seed),
    nologo: "true",
    enhance: "true",
  });
  if (options?.key) params.set("key", options.key);

  // Primary: classic Pollinations prompt endpoint (often works without key for light use)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

/** Alternate endpoint if primary fails to load */
export function buildCoverImageUrlAlt(
  post: CalendarPost,
  options?: { seed?: number; key?: string },
): string {
  const prompt = buildCoverPrompt(post);
  const seed = options?.seed ?? hashSeed(post.id) + 7;
  const params = new URLSearchParams({
    model: "flux",
    width: String(WIDTH),
    height: String(HEIGHT),
    seed: String(seed),
  });
  if (options?.key) params.set("key", options.key);
  return `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params.toString()}`;
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100000;
}
