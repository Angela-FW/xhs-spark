import type { CalendarPost } from "./year-calendar";
import { withAuthHeaders } from "@/lib/auth-fetch";
import { fitCoverToNoteSize } from "@/lib/cover-compose";
import { distillCoverVisualPrompt } from "@/lib/cover-scene";
import type { CreatorPersona } from "@/lib/persona";

/** Xiaohongshu 3:4. Cloudflare Flux ignores size; we crop after generation. */
const WIDTH = 1080;
const HEIGHT = 1440;
const SIZE = `${WIDTH}x${HEIGHT}`;

export type CoverProvider = "cloudflare" | "siliconflow" | "pollinations";

export type CoverCredentials = {
  provider: CoverProvider;
  cloudflareAccountId?: string;
  cloudflareToken?: string;
  siliconflowKey?: string;
  pollinationsKey?: string;
};

export function buildCoverPrompt(
  post: CalendarPost,
  options?: {
    title?: string;
    body?: string;
    userPrompt?: string;
    persona?: Pick<
      CreatorPersona,
      | "presetId"
      | "contentMix"
      | "name"
      | "background"
      | "audience"
      | "stage"
      | "voice"
    >;
  },
): string {
  return distillCoverVisualPrompt({
    title: options?.title || post.titleHint,
    body: options?.body,
    angle: post.angle,
    userPrompt: options?.userPrompt,
    presetId: options?.persona?.presetId,
    contentMix: options?.persona?.contentMix,
    format: post.format,
    personaName: options?.persona?.name,
    background: options?.persona?.background,
    audience: options?.persona?.audience,
    stage: options?.persona?.stage,
    voice: options?.persona?.voice,
  });
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

async function parseImageResponse(res: Response): Promise<string> {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const detail =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error ?? "")
        : "";
    throw new Error(detail || `生图失败 (${res.status})。请稍后重试。`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as {
      data?: { b64_json?: string; url?: string }[];
      error?: string | { message?: string };
    };
    if (json.error) {
      throw new Error(
        typeof json.error === "string"
          ? json.error
          : json.error.message || "生图失败",
      );
    }
    const first = json.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) {
      const raw = first.b64_json;
      if (raw.startsWith("data:")) return raw;
      return `data:image/jpeg;base64,${raw}`;
    }
    throw new Error("接口未返回图片数据");
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Text-to-image via local multi-provider proxy. */
export async function generateCoverImage(
  post: CalendarPost,
  options?: {
    seed?: number;
    prompt?: string;
    title?: string;
    noteBody?: string;
    userPrompt?: string;
    persona?: Pick<
      CreatorPersona,
      | "presetId"
      | "contentMix"
      | "name"
      | "background"
      | "audience"
      | "stage"
      | "voice"
    >;
    credentials?: CoverCredentials;
    signal?: AbortSignal;
  },
): Promise<string> {
  const creds = options?.credentials;
  const provider = creds?.provider ?? "cloudflare";
  const visual = distillCoverVisualPrompt({
    title: options?.title || post.titleHint,
    body: options?.noteBody,
    angle: post.angle,
    userPrompt: options?.userPrompt ?? options?.prompt,
    presetId: options?.persona?.presetId,
    contentMix: options?.persona?.contentMix,
    format: post.format,
    personaName: options?.persona?.name,
    background: options?.persona?.background,
    audience: options?.persona?.audience,
    stage: options?.persona?.stage,
    voice: options?.persona?.voice,
  });
  const seed = options?.seed ?? hashSeed(post.id + visual.slice(0, 24));

  const headers: HeadersInit = await withAuthHeaders({
    "Content-Type": "application/json",
  });
  if (provider === "cloudflare" && creds?.cloudflareToken) {
    (headers as Record<string, string>)["x-cloudflare-token"] =
      creds.cloudflareToken;
  }
  if (provider === "siliconflow" && creds?.siliconflowKey) {
    (headers as Record<string, string>)["x-siliconflow-key"] =
      creds.siliconflowKey;
  }
  if (provider === "pollinations" && creds?.pollinationsKey) {
    (headers as Record<string, string>)["x-pollinations-key"] =
      creds.pollinationsKey;
  }

  const res = await fetch("/api/cover-generate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: visual,
      title: options?.title || post.titleHint,
      noteBody: options?.noteBody,
      angle: post.angle,
      userPrompt: options?.userPrompt ?? options?.prompt,
      presetId: options?.persona?.presetId,
      contentMix: options?.persona?.contentMix,
      format: post.format,
      personaName: options?.persona?.name,
      background: options?.persona?.background,
      audience: options?.persona?.audience,
      stage: options?.persona?.stage,
      voice: options?.persona?.voice,
      provider,
      size: SIZE,
      seed,
      cloudflareAccountId: creds?.cloudflareAccountId,
      cloudflareToken: creds?.cloudflareToken,
      apiKey:
        provider === "siliconflow"
          ? creds?.siliconflowKey
          : provider === "pollinations"
            ? creds?.pollinationsKey
            : undefined,
    }),
    signal: options?.signal,
  });

  return fitCoverToNoteSize(await parseImageResponse(res));
}

/**
 * Upload a local reference file for img2img via local proxy (Cloudflare by default).
 */
export async function editCoverFromFile(
  post: CalendarPost,
  file: File,
  options?: {
    seed?: number;
    prompt?: string;
    credentials?: CoverCredentials;
    signal?: AbortSignal;
  },
): Promise<string> {
  const prompt = resolvePrompt(post, options?.prompt, true);
  const compressed = await compressImageFile(file, 1024, 0.85);
  const provider = options?.credentials?.provider ?? "cloudflare";

  const form = new FormData();
  form.append("image", compressed, compressed.name || "reference.jpg");
  form.append("prompt", prompt);
  form.append("provider", provider);
  form.append("strength", "0.65");
  if (options?.seed != null) form.append("seed", String(options.seed));
  if (options?.credentials?.cloudflareAccountId) {
    form.append(
      "cloudflareAccountId",
      options.credentials.cloudflareAccountId,
    );
  }

  const headers: HeadersInit = await withAuthHeaders();
  if (provider === "pollinations" && options?.credentials?.pollinationsKey) {
    (headers as Record<string, string>)["x-pollinations-key"] =
      options.credentials.pollinationsKey;
  }
  if (provider === "cloudflare" && options?.credentials?.cloudflareToken) {
    (headers as Record<string, string>)["x-cloudflare-token"] =
      options.credentials.cloudflareToken;
  }

  const res = await fetch("/api/cover-edit", {
    method: "POST",
    headers,
    body: form,
    signal: options?.signal,
  });
  return fitCoverToNoteSize(await parseImageResponse(res));
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
