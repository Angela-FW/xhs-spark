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

export function buildImg2ImgPrompt(post: CalendarPost): string {
  return [
    buildCoverPrompt(post),
    "Keep the same person/face identity and main composition from the reference photo",
    "Restyle as Xiaohongshu vertical cover, soft lighting, tasteful, no text",
  ].join(", ");
}

function resolvePrompt(
  post: CalendarPost,
  customPrompt?: string,
  forImg2Img = false,
): string {
  const custom = customPrompt?.trim();
  if (custom) {
    return forImg2Img
      ? `${custom}. Keep the same person/face identity and main composition from the reference photo, Xiaohongshu vertical cover 3:4, no text overlay`
      : custom;
  }
  return forImg2Img ? buildImg2ImgPrompt(post) : buildCoverPrompt(post);
}

export function buildCoverImageUrl(
  post: CalendarPost,
  options?: { seed?: number; prompt?: string },
): string {
  const prompt = resolvePrompt(post, options?.prompt, false);
  const seed = options?.seed ?? hashSeed(post.id + prompt.slice(0, 24));
  const params = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    model: "flux",
    seed: String(seed),
    nologo: "true",
    enhance: "true",
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export function buildCoverImageUrlAlt(
  post: CalendarPost,
  options?: { seed?: number; prompt?: string },
): string {
  const prompt = resolvePrompt(post, options?.prompt, false);
  const seed = options?.seed ?? hashSeed(post.id + prompt.slice(0, 24)) + 7;
  const params = new URLSearchParams({
    model: "flux",
    width: String(WIDTH),
    height: String(HEIGHT),
    seed: String(seed),
  });
  return `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params.toString()}`;
}

/** Text+reference via GET (needs a publicly reachable image URL). */
export function buildImg2ImgUrl(
  post: CalendarPost,
  referenceImageUrl: string,
  options?: { seed?: number; prompt?: string },
): string {
  const prompt = resolvePrompt(post, options?.prompt, true);
  const seed =
    options?.seed ?? hashSeed(post.id + referenceImageUrl.slice(-12) + prompt.slice(0, 16));
  const params = new URLSearchParams({
    model: "kontext",
    image: referenceImageUrl,
    width: String(WIDTH),
    height: String(HEIGHT),
    seed: String(seed),
    nologo: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

/**
 * Upload a local reference file and request an edited cover.
 * Uses Pollinations OpenAI-compatible edits endpoint.
 */
export async function editCoverFromFile(
  post: CalendarPost,
  file: File,
  options?: { seed?: number; prompt?: string; signal?: AbortSignal },
): Promise<string> {
  const prompt = resolvePrompt(post, options?.prompt, true);
  const compressed = await compressImageFile(file, 1280, 0.85);

  const form = new FormData();
  form.append("image", compressed, compressed.name || "reference.jpg");
  form.append("prompt", prompt);
  form.append("model", "kontext");
  form.append("size", `${WIDTH}x${HEIGHT}`);
  if (options?.seed != null) form.append("seed", String(options.seed));

  // Local Next.js proxy avoids browser CORS with Pollinations
  const res = await fetch("/api/cover-edit", {
    method: "POST",
    body: form,
    signal: options?.signal,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const detail =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error ?? "")
        : "";
    throw new Error(
      `图生图失败 (${res.status})。${
        detail || "请稍后重试，或改用公网图片链接 + 提示词生成。"
      }`,
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as {
      data?: { b64_json?: string; url?: string }[];
      error?: string;
    };
    if (json.error) throw new Error(json.error);
    const first = json.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    throw new Error("接口未返回图片数据");
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function compressImageFile(
  file: File,
  maxSide = 1280,
  quality = 0.85,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100000;
}
