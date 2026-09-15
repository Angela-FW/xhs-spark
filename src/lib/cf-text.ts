/** Site-shared Cloudflare Workers AI for copy / polish / distill. */

export const CF_TEXT_MODEL = "@cf/zai-org/glm-4.7-flash";
export const CF_TEXT_FALLBACK_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

export const CF_TEXT_MISSING_CREDS =
  "服务端未配置文生模型（缺少 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN）";

export type CfTextResult = {
  text: string;
  model: string;
};

type CfTextOptions = {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

type CfJson = {
  success?: boolean;
  result?: {
    response?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  choices?: Array<{ message?: { content?: unknown } }>;
  errors?: Array<{ message?: string; code?: number }>;
};

export function cfTextCreds(): { id: string; token: string } {
  return {
    id: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "",
    token: process.env.CLOUDFLARE_API_TOKEN?.trim() || "",
  };
}

export function hasCfTextCreds(): boolean {
  const { id, token } = cfTextCreds();
  return Boolean(id && token);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const rec = part as { text?: unknown; content?: unknown };
          return asText(rec.text ?? rec.content);
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function extractCfText(data: unknown): string {
  const d = (data || {}) as CfJson & { result?: unknown };
  if (typeof d.result === "string") return d.result;
  const result = d.result as
    | {
        response?: unknown;
        choices?: Array<{
          message?: {
            content?: unknown;
            reasoning?: unknown;
            reasoning_content?: unknown;
          };
        }>;
      }
    | undefined;
  const msg = result?.choices?.[0]?.message || d.choices?.[0]?.message;
  const content = asText(msg?.content).trim();
  if (content) return content;
  const reasoned = asText(
    (msg as { reasoning_content?: unknown; reasoning?: unknown } | undefined)
      ?.reasoning_content ??
      (msg as { reasoning?: unknown } | undefined)?.reasoning,
  ).trim();
  if (reasoned && !/^(好的[，,]?用户|首先[，,]|我需要确认|用户让我)/.test(reasoned)) {
    return reasoned;
  }
  return asText(result?.response);
}

export function stripModelExtras(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^```[\w]*\s*|\s*```$/g, "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/^标题[：:].*\n+/m, "")
    .replace(/^(正文|润色后的正文|润色|改写)[：:]\s*/m, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function errorMessage(data: CfJson | null, status: number): string {
  return data?.errors?.[0]?.message || `Cloudflare text API ${status}`;
}

async function runOneModel(
  model: string,
  options: CfTextOptions,
): Promise<CfTextResult> {
  const { id, token } = cfTextCreds();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${model}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const system =
    options.system.startsWith("/no_think")
      ? options.system
      : `/no_think\n${options.system}`;
  const baseBody = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: options.user },
    ],
    max_tokens: options.maxTokens,
    temperature: options.temperature,
  };

  const call = (body: Record<string, unknown>) =>
    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

  let upstream = await call({
    ...baseBody,
    chat_template_kwargs: { enable_thinking: false },
  });
  let data = (await upstream.json().catch(() => null)) as CfJson | null;

  if (upstream.status === 400) {
    upstream = await call(baseBody);
    data = (await upstream.json().catch(() => null)) as CfJson | null;
  }

  if (!upstream.ok || data?.success === false) {
    throw new Error(errorMessage(data, upstream.status));
  }

  const text = stripModelExtras(extractCfText(data));
  if (!text) {
    throw new Error("模型返回为空");
  }
  return { text, model };
}

/** GLM-4.7-Flash first (better Chinese diary); Qwen3 if GLM fails. */
export async function runCfText(options: CfTextOptions): Promise<CfTextResult> {
  try {
    return await runOneModel(CF_TEXT_MODEL, options);
  } catch (err) {
    if (options.signal?.aborted) throw err;
    try {
      return await runOneModel(CF_TEXT_FALLBACK_MODEL, options);
    } catch {
      throw err;
    }
  }
}
