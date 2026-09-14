import type { CoverDistillInput } from "@/lib/cover-scene";
import { coverPromptHasHeavyCjk } from "@/lib/cover-scene";

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

function textCfCreds(): { id: string; token: string } {
  return {
    id: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "",
    token: process.env.CLOUDFLARE_API_TOKEN?.trim() || "",
  };
}

function clip(value: string | undefined, max: number): string {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeEnglishKeywords(raw: string): string {
  let text = raw
    .trim()
    .replace(/^```[\w]*\s*|\s*```$/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(prompt|keywords)\s*[:=]\s*/i, "")
    .replace(/[\u3400-\u9fff]/g, " ")
    .replace(/[。；、]/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 24) return "";
  if (!/no text/i.test(text)) {
    text += ", no text, no letters, no Chinese characters, no watermark, no logo";
  }
  if (!/no people|no person|no faces/i.test(text)) {
    text += ", no people, no faces";
  }
  return text.slice(0, 700);
}

/**
 * Translate persona + title + body into English visual keywords for Flux T2I.
 * Uses the site text model (same CLOUDFLARE_* as note writing). Returns null on failure.
 */
export async function distillCoverPromptWithLlm(
  input: CoverDistillInput,
): Promise<string | null> {
  const { id, token } = textCfCreds();
  if (!id || !token) return null;

  const title = clip(input.title, 80);
  const body = clip(input.body, 420);
  if (!title && !body && !clip(input.userPrompt, 80)) return null;

  const system = [
    "You write prompts for Flux text-to-image.",
    "Read the Chinese note. Extract only visible things: objects, place, lighting, materials, colors.",
    "Output ONE line of English comma-separated keywords. No sentences. No Chinese. No quotes. No explanation.",
    "Always include: photorealistic still life, vertical 3:4 cover, natural light.",
    "Always include: no people, no faces, no text, no letters, no watermark.",
    "Do not illustrate abstract feelings. Convert them into concrete objects from the topic.",
  ].join(" ");

  const user = [
    input.personaName ? `Persona name: ${clip(input.personaName, 40)}` : "",
    input.background ? `Persona field: ${clip(input.background, 40)}` : "",
    input.stage ? `Stage: ${clip(input.stage, 40)}` : "",
    input.audience ? `Audience: ${clip(input.audience, 40)}` : "",
    input.voice ? `Voice: ${clip(input.voice, 40)}` : "",
    input.presetId ? `Preset: ${input.presetId}` : "",
    title ? `Title: ${title}` : "",
    input.angle ? `Angle: ${clip(input.angle, 80)}` : "",
    body ? `Body: ${body}` : "",
    input.userPrompt ? `User visual notes: ${clip(input.userPrompt, 200)}` : "",
    "English keywords only:",
  ]
    .filter(Boolean)
    .join("\n");

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${TEXT_MODEL}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 180,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const data = (await upstream.json().catch(() => null)) as {
      success?: boolean;
      result?: { response?: string };
    } | null;

    if (!upstream.ok || !data?.success) return null;
    const cleaned = sanitizeEnglishKeywords(String(data.result?.response || ""));
    if (!cleaned || coverPromptHasHeavyCjk(cleaned)) return null;
    return cleaned;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
