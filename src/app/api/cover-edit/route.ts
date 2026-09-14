import { NextRequest, NextResponse } from "next/server";
import { buildFluxPrompt } from "@/lib/cover-prompt";
import {
  isLocalCoverFallback,
  resolveCloudflareCoverCreds,
  resolveCoverApiKey,
} from "@/lib/cover-server";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

function jsonError(message: string, status: number, detail?: string) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail: detail.slice(0, 400) } : {}) },
    { status },
  );
}

/**
 * Image-to-image cover edit.
 * Uses the signed-in user's own provider keys (no shared site quota).
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireUserForAi(req);
    if (!gate.ok) return gate.response;

    const incoming = await req.formData();
    const image = incoming.get("image");
    const prompt = String(incoming.get("prompt") ?? "");
    const provider = String(incoming.get("provider") ?? "cloudflare");
    const strength = Number(incoming.get("strength") ?? 0.65);

    if (!image || !(image instanceof Blob) || !prompt) {
      return jsonError("需要 image 与 prompt", 400);
    }

    if (provider === "pollinations") {
      const key = resolveCoverApiKey(
        req.headers.get("x-pollinations-key")?.trim() || "",
        "POLLINATIONS_API_KEY",
      );
      if (!key) {
        return jsonError(
          isLocalCoverFallback()
            ? "本地未配置 Pollinations：请填写页面 Key，或在 .env.local 增加 POLLINATIONS_API_KEY。"
            : "未配置 Pollinations Key：请在生成页填写你自己的 API Key（登录后会同步到账号）。",
          401,
        );
      }
      const form = new FormData();
      form.append(
        "image",
        image,
        image instanceof File ? image.name : "reference.jpg",
      );
      form.append("prompt", prompt);
      form.append("model", "kontext");
      form.append("size", "1080x1440");
      const seed = incoming.get("seed");
      if (seed != null && String(seed)) form.append("seed", String(seed));

      const upstream = await fetch("https://gen.pollinations.ai/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        return jsonError(`上游失败 ${upstream.status}`, upstream.status, text);
      }
      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      if (contentType.includes("application/json")) {
        return NextResponse.json(await upstream.json());
      }
      const buf = await upstream.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
      });
    }

    // Cloudflare img2img — production uses the signed-in user's keys only
    const { accountId, token } = resolveCloudflareCoverCreds({
      accountId: String(incoming.get("cloudflareAccountId") ?? ""),
      token: req.headers.get("x-cloudflare-token")?.trim() || "",
    });
    if (!accountId || !token) {
      return jsonError(
        isLocalCoverFallback()
          ? "本地未配置生图：请在 .env.local 填写 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN。"
          : "未配置生图 Key：请在生成页填写你自己的 Cloudflare Account ID 与 API Token（登录后会同步到账号）。",
        401,
      );
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    // Avoid huge payloads; SD img2img accepts image_b64
    const image_b64 = Buffer.from(bytes).toString("base64");

    const model = "@cf/runwayml/stable-diffusion-v1-5-img2img";
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: buildFluxPrompt(
          `${prompt}. Keep composition close to the reference image.`,
        ),
        image_b64,
        strength: Math.min(1, Math.max(0.2, strength || 0.65)),
        num_steps: 20,
        guidance: 7.5,
      }),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      let detail = text.slice(0, 400);
      try {
        const parsed = JSON.parse(text) as {
          errors?: { message?: string }[];
          error?: string;
        };
        detail =
          parsed.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
          parsed.error ||
          detail;
      } catch {
        /* keep */
      }
      if (upstream.status === 429 || /quota|neuron|limit/i.test(detail)) {
        return jsonError(
          "今日 Cloudflare 免费额度已用完，请明天再试，或先去掉参考图改用文生图。",
          429,
          detail,
        );
      }
      return jsonError(`Cloudflare 图生图失败 (${upstream.status})`, upstream.status, detail);
    }

    // API may return raw binary image or JSON with result
    if (contentType.includes("application/json")) {
      const json = (await upstream.json()) as {
        success?: boolean;
        result?: string | { image?: string };
        errors?: { message?: string }[];
      };
      if (json.success === false) {
        const detail = json.errors?.map((e) => e.message).join("; ") || "";
        return jsonError("Cloudflare 图生图失败", 502, detail);
      }
      // Sometimes result is base64 string directly
      if (typeof json.result === "string") {
        return NextResponse.json({ data: [{ b64_json: json.result }] });
      }
      if (json.result && typeof json.result === "object" && json.result.image) {
        return NextResponse.json({
          data: [{ b64_json: json.result.image }],
        });
      }
      return jsonError("Cloudflare 未返回图片数据", 502);
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "代理失败", 500);
  }
}
