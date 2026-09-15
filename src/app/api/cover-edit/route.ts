import { NextRequest, NextResponse } from "next/server";
import { buildCoverImagePrompt } from "@/lib/cover-prompt";
import { kolorsErrorMessage, runKolors } from "@/lib/cover-kolors";
import { missingSiliconflowKeyMessage, resolveSiliconflowKey } from "@/lib/cover-server";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

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
 * Kolors img2img with the signed-in user's own SiliconFlow key.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireUserForAi(req);
    if (!gate.ok) return gate.response;

    const incoming = await req.formData();
    const image = incoming.get("image");
    const prompt = String(incoming.get("prompt") ?? "");

    if (!image || !(image instanceof Blob) || !prompt) {
      return jsonError("需要 image 与 prompt", 400);
    }

    const apiKey = resolveSiliconflowKey(
      req.headers.get("x-siliconflow-key")?.trim() ||
        String(incoming.get("apiKey") ?? ""),
    );
    if (!apiKey) return jsonError(missingSiliconflowKeyMessage(), 401);

    const bytes = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    const seed = Number(incoming.get("seed") ?? Date.now() % 100000) || 1;

    const result = await runKolors({
      apiKey,
      prompt: buildCoverImagePrompt(
        `${prompt}. Keep composition close to the reference image.`,
      ),
      seed,
      image: dataUrl,
    });
    if (!result.ok) {
      return jsonError(kolorsErrorMessage(result.status, result.detail), result.status, result.detail);
    }
    return asImageJson(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "代理失败", 500);
  }
}
