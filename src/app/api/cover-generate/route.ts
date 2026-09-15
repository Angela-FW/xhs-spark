import { NextRequest, NextResponse } from "next/server";
import { distillCoverPromptWithLlm } from "@/lib/cover-distill-server";
import { buildCoverImagePrompt } from "@/lib/cover-prompt";
import { kolorsErrorMessage, runKolors } from "@/lib/cover-kolors";
import { missingSiliconflowKeyMessage, resolveSiliconflowKey } from "@/lib/cover-server";
import { resolveCoverVisualPrompt } from "@/lib/cover-scene";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
  title?: string;
  noteBody?: string;
  angle?: string;
  userPrompt?: string;
  presetId?: string;
  contentMix?: string;
  format?: string;
  personaName?: string;
  background?: string;
  audience?: string;
  stage?: string;
  voice?: string;
  apiKey?: string;
  seed?: number | string;
};

function jsonError(message: string, status: number, detail?: string) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail: detail.slice(0, 400) } : {}) },
    { status },
  );
}

function asImageJson(result: { b64?: string; url?: string }) {
  if (result.b64) {
    const cleaned = result.b64.replace(/^data:image\/\w+;base64,/, "");
    return NextResponse.json({ data: [{ b64_json: cleaned }] });
  }
  if (result.url) {
    return NextResponse.json({ data: [{ url: result.url }] });
  }
  return jsonError("硅基流动未返回图片数据", 502);
}

/**
 * Kolors cover generation with the signed-in user's own SiliconFlow key.
 * The site never pays image quota from a shared key.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireUserForAi(req);
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as Body;
    const distillInput = {
      prompt: body.prompt,
      title: body.title,
      body: body.noteBody,
      angle: body.angle,
      userPrompt: body.userPrompt,
      presetId: body.presetId,
      contentMix: body.contentMix,
      format: body.format,
      personaName: body.personaName,
      background: body.background,
      audience: body.audience,
      stage: body.stage,
      voice: body.voice,
    };
    const typed = (body.userPrompt || "").trim();
    let prompt: string;
    if (typed) {
      // User box is the only source — do not distill title/body into the image.
      prompt = buildCoverImagePrompt(typed);
    } else {
      const topicInput = { ...distillInput, userPrompt: "" };
      const fallback = resolveCoverVisualPrompt(topicInput);
      const translated = await distillCoverPromptWithLlm(topicInput);
      prompt = buildCoverImagePrompt(translated || fallback);
    }
    if (!prompt) return jsonError("需要 prompt", 400);

    const apiKey = resolveSiliconflowKey(
      body.apiKey?.trim() || req.headers.get("x-siliconflow-key")?.trim() || "",
    );
    if (!apiKey) return jsonError(missingSiliconflowKeyMessage(), 401);

    const seed = Number(body.seed ?? Date.now() % 100000) || 1;
    const result = await runKolors({ apiKey, prompt, seed });
    if (!result.ok) {
      console.error("Kolors failed", result.status, result.detail.slice(0, 200));
      return jsonError(kolorsErrorMessage(result.status, result.detail), result.status, result.detail);
    }
    return asImageJson(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "代理失败", 500);
  }
}
