import { NextRequest, NextResponse } from "next/server";
import { distillCoverPromptWithLlm } from "@/lib/cover-distill-server";
import { buildFluxPrompt } from "@/lib/cover-prompt";
import { resolveCoverVisualPrompt } from "@/lib/cover-scene";
import {
  isLocalCoverFallback,
  resolveCloudflareCoverCreds,
  resolveCoverApiKey,
} from "@/lib/cover-server";
import { requireUserForAi } from "@/lib/supabase-server";

export const runtime = "nodejs";

export type CoverProvider = "cloudflare" | "siliconflow" | "pollinations";

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
  provider?: CoverProvider;
  seed?: number | string;
  size?: string;
  /** Cloudflare */
  cloudflareAccountId?: string;
  cloudflareToken?: string;
  /** SiliconFlow / Pollinations */
  apiKey?: string;
  /** Optional public reference URL (Pollinations kontext / SiliconFlow when supported) */
  image?: string;
};

function jsonError(message: string, status: number, detail?: string) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail: detail.slice(0, 400) } : {}) },
    { status },
  );
}

function asDataUrl(b64: string, mime = "image/jpeg") {
  const cleaned = b64.replace(/^data:image\/\w+;base64,/, "");
  return NextResponse.json({
    data: [{ b64_json: cleaned }],
  });
}

async function generateCloudflare(opts: {
  prompt: string;
  seed: number;
  accountId: string;
  token: string;
}) {
  const model = "@cf/black-forest-labs/flux-1-schnell";
  const url = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/ai/run/${model}`;
  const prompt = opts.prompt;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      steps: 6,
      seed: opts.seed,
    }),
  });

  const text = await upstream.text();
  let parsed: {
    success?: boolean;
    result?: { image?: string };
    errors?: { message?: string }[];
    error?: string;
  } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return jsonError(`Cloudflare 返回异常 (${upstream.status})`, upstream.status || 502, text);
  }

  if (!upstream.ok || parsed.success === false) {
    const detail =
      parsed.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      parsed.error ||
      text;
    if (upstream.status === 429 || /quota|limit|neuron/i.test(detail)) {
      return jsonError(
        "今日 Cloudflare 免费额度已用完（约 1 万 Neurons/天，次日 UTC 0 点重置）。可改用「硅基流动」或明天再试。",
        429,
        detail,
      );
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return jsonError(
        "Cloudflare 鉴权失败。请检查 Account ID 与 API Token（需 Workers AI 权限）。",
        upstream.status,
        detail,
      );
    }
    return jsonError(`Cloudflare 生图失败 (${upstream.status})`, upstream.status || 502, detail);
  }

  const image = parsed.result?.image;
  if (!image) return jsonError("Cloudflare 未返回图片数据", 502);
  return asDataUrl(image, "image/jpeg");
}

async function generateSiliconFlow(opts: {
  prompt: string;
  seed: number;
  apiKey: string;
  size: string;
  image?: string;
}) {
  const payload: Record<string, unknown> = {
    model: "black-forest-labs/FLUX.1-schnell",
    prompt: opts.prompt,
    image_size: opts.size === "1080x1440" ? "768x1024" : opts.size,
    seed: opts.seed,
  };
  if (opts.image) {
    // Kolors supports img2img better; keep FLUX for free text-to-image.
    // If user provided a reference URL, append a soft hint — true img2img needs Kolors.
    payload.prompt = `${opts.prompt}. Inspired by the reference mood and composition.`;
  }

  const upstream = await fetch("https://api.siliconflow.cn/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "X-Enable-Watermark": "0",
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  let parsed: {
    images?: { url?: string; b64_json?: string }[];
    data?: { url?: string; b64_json?: string }[];
    error?: string | { message?: string };
    message?: string;
    code?: number | string;
  } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return jsonError(`硅基流动返回异常 (${upstream.status})`, upstream.status || 502, text);
  }

  if (!upstream.ok) {
    const detail =
      (typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message) ||
      parsed.message ||
      text;
    if (upstream.status === 429) {
      return jsonError(
        "硅基流动今日免费额度已用完（免费模型有每日上限）。可改用 Cloudflare，或明天再试。",
        429,
        detail,
      );
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return jsonError(
        "硅基流动鉴权失败。请检查 API Key；免费模型通常需完成实名认证。",
        upstream.status,
        detail,
      );
    }
    return jsonError(`硅基流动生图失败 (${upstream.status})`, upstream.status || 502, detail);
  }

  const first = parsed.images?.[0] || parsed.data?.[0];
  if (first?.b64_json) return asDataUrl(first.b64_json);
  if (first?.url) {
    return NextResponse.json({ data: [{ url: first.url }] });
  }
  return jsonError("硅基流动未返回图片数据", 502, text.slice(0, 300));
}

async function generatePollinations(opts: {
  prompt: string;
  seed: number;
  apiKey: string;
  size: string;
  image?: string;
}) {
  const payload: Record<string, unknown> = {
    prompt: opts.prompt,
    model: opts.image ? "kontext" : "flux",
    size: opts.size,
    n: 1,
    response_format: "b64_json",
    seed: opts.seed,
  };
  if (opts.image) payload.image = opts.image;

  const upstream = await fetch("https://gen.pollinations.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    let detail = text.slice(0, 400);
    try {
      const p = JSON.parse(text) as { error?: { message?: string } | string };
      if (typeof p.error === "string") detail = p.error;
      else if (p.error?.message) detail = p.error.message;
    } catch {
      /* keep */
    }
    return jsonError(
      upstream.status === 401 || upstream.status === 403
        ? `Pollinations 鉴权失败（${upstream.status}）。免费额度不足时可改用 Cloudflare / 硅基流动。`
        : `Pollinations 上游失败 ${upstream.status}`,
      upstream.status,
      detail,
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return NextResponse.json(await upstream.json());
  }
  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType || "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Multi-provider cover generation.
 * Prefer Cloudflare (10k Neurons/day free) or SiliconFlow (free model daily caps).
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
    const fallback = resolveCoverVisualPrompt(distillInput);
    const translated = await distillCoverPromptWithLlm(distillInput);
    const prompt = buildFluxPrompt(translated || fallback);
    if (!prompt) return jsonError("需要 prompt", 400);

    const provider: CoverProvider = body.provider || "cloudflare";

    const seed = Number(body.seed ?? Date.now() % 100000) || 1;
    const size = String(body.size || "1080x1440");
    const image = body.image?.trim() || undefined;

    if (provider === "cloudflare") {
      const { accountId, token } = resolveCloudflareCoverCreds({
        accountId: body.cloudflareAccountId,
        token:
          body.cloudflareToken?.trim() ||
          req.headers.get("x-cloudflare-token")?.trim() ||
          "",
      });
      if (!accountId || !token) {
        return jsonError(
          isLocalCoverFallback()
            ? "本地未配置生图：请在 .env.local 填写 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN。"
            : "未配置生图 Key：请在生成页填写你自己的 Cloudflare Account ID 与 API Token（登录后会同步到账号）。",
          401,
        );
      }
      if (image) {
        // flux-1-schnell has no img2img — still generate from prompt only
      }
      return generateCloudflare({ prompt, seed, accountId, token });
    }

    if (provider === "siliconflow") {
      const apiKey = resolveCoverApiKey(
        body.apiKey?.trim() || req.headers.get("x-siliconflow-key")?.trim() || "",
        "SILICONFLOW_API_KEY",
      );
      if (!apiKey) {
        return jsonError(
          isLocalCoverFallback()
            ? "本地未配置硅基流动：请填写页面 Key，或在 .env.local 增加 SILICONFLOW_API_KEY。"
            : "未配置硅基流动 Key：请在生成页填写你自己的 API Key（登录后会同步到账号）。",
          401,
        );
      }
      return generateSiliconFlow({ prompt, seed, apiKey, size, image });
    }

    // pollinations
    const apiKey = resolveCoverApiKey(
      body.apiKey?.trim() || req.headers.get("x-pollinations-key")?.trim() || "",
      "POLLINATIONS_API_KEY",
    );
    if (!apiKey) {
      return jsonError(
        isLocalCoverFallback()
          ? "本地未配置 Pollinations：请填写页面 Key，或在 .env.local 增加 POLLINATIONS_API_KEY。"
          : "未配置 Pollinations Key：请在生成页填写你自己的 API Key（登录后会同步到账号）。",
        401,
      );
    }
    return generatePollinations({ prompt, seed, apiKey, size, image });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "代理失败", 500);
  }
}
