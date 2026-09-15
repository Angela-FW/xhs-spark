/** SiliconFlow Kolors — the only cover model. Callers pass the signed-in user's key. */

export const KOLORS_MODEL = "Kwai-Kolors/Kolors";
/** Official 3:4 size; client later fits to 1080x1440. */
export const KOLORS_SIZE = "960x1280";

export type KolorsOk = { ok: true; b64?: string; url?: string };
export type KolorsErr = { ok: false; status: number; detail: string };
export type KolorsResult = KolorsOk | KolorsErr;

export async function runKolors(opts: {
  apiKey: string;
  prompt: string;
  seed: number;
  /** data URL or public URL for img2img */
  image?: string;
}): Promise<KolorsResult> {
  const payload: Record<string, unknown> = {
    model: KOLORS_MODEL,
    prompt: opts.prompt,
    image_size: KOLORS_SIZE,
    batch_size: 1,
    num_inference_steps: 20,
    guidance_scale: 7.5,
    seed: opts.seed,
    negative_prompt:
      "text, letters, numbers, watermark, logo, extra fingers, deformed hands, extra limbs",
  };
  if (opts.image) payload.image = opts.image;

  const sizes = opts.image ? [KOLORS_SIZE] : [KOLORS_SIZE, "768x1024"];
  let last: KolorsResult | undefined;
  for (let i = 0; i < sizes.length; i++) {
    payload.image_size = sizes[i];
    last = await callKolors(opts.apiKey, payload);
    if (last.ok) return last;
    // 400 on size / 5xx blip: try the next official size once.
    if (last.status !== 400 && last.status < 500) return last;
  }
  return last ?? { ok: false, status: 502, detail: "empty Kolors response" };
}

async function callKolors(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<KolorsResult> {
  const upstream = await fetch("https://api.siliconflow.cn/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  let parsed: {
    images?: { url?: string; b64_json?: string }[];
    data?: { url?: string; b64_json?: string }[];
    error?: string | { message?: string };
    message?: string;
  } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return {
      ok: false,
      status: upstream.status || 502,
      detail: text.slice(0, 400),
    };
  }

  if (!upstream.ok) {
    const detail =
      (typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message) ||
      parsed.message ||
      text.slice(0, 400);
    return { ok: false, status: upstream.status, detail };
  }

  const first = parsed.images?.[0] || parsed.data?.[0];
  if (first?.b64_json) return { ok: true, b64: first.b64_json };
  if (first?.url) return { ok: true, url: first.url };
  return { ok: false, status: 502, detail: text.slice(0, 300) };
}

export function kolorsErrorMessage(status: number, detail: string): string {
  const d = (detail || "").toLowerCase();
  if (
    status === 429 ||
    /rate.?limit|quota|exceed|额度|次数|too many/i.test(d)
  ) {
    return "硅基流动今日免费额度已用完（Kolors 有每日上限）。请明天再试。";
  }
  if (
    status === 401 ||
    status === 403 ||
    /unauthorized|invalid api|api key|鉴权|实名/.test(d)
  ) {
    return "硅基流动鉴权失败。请检查 API Key；免费模型需完成实名认证。";
  }
  if (/balance|insufficient|欠费|余额/.test(d)) {
    return "硅基流动余额不足。请检查账号额度。";
  }
  if (status >= 500) {
    return "硅基流动服务暂时异常，请稍后重试。";
  }
  return `硅基流动生图失败 (${status})`;
}
