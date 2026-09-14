"use client";

import type { CoverCredentials, CoverProvider } from "@/lib/cover-image";

const STORAGE_KEY = "restart-cover-keys-v1";

export type StoredCoverKeys = CoverCredentials & {
  /** User skipped or saved empty — treat as not ready for AI covers. */
  configuredAt?: string;
};

export const COVER_KEY_LINKS = {
  cloudflare: {
    label: "Cloudflare Workers AI",
    href: "https://dash.cloudflare.com/?to=/:account/ai/workers-ai",
    help: "免费约 1 万 Neurons/天（约 170 张）。创建 Account ID，并申请带 Workers AI 权限的 API Token。登录后会同步到你的账号。",
  },
  siliconflow: {
    label: "硅基流动",
    href: "https://cloud.siliconflow.cn",
    help: "注册并实名后可免费调用部分模型（有每日上限）。登录后会同步到你的账号。",
  },
  pollinations: {
    label: "Pollinations",
    href: "https://auth.pollinations.ai",
    help: "备选线路；建议优先用 Cloudflare 免费额度。登录后会同步到你的账号。",
  },
} as const;

export function loadCoverKeys(): StoredCoverKeys {
  if (typeof window === "undefined") {
    return { provider: "cloudflare" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { provider: "cloudflare" };
    const parsed = JSON.parse(raw) as StoredCoverKeys;
    return {
      provider: parsed.provider || "cloudflare",
      cloudflareAccountId: parsed.cloudflareAccountId || "",
      cloudflareToken: parsed.cloudflareToken || "",
      siliconflowKey: parsed.siliconflowKey || "",
      pollinationsKey: parsed.pollinationsKey || "",
      configuredAt: parsed.configuredAt,
    };
  } catch {
    return { provider: "cloudflare" };
  }
}

export function saveCoverKeys(keys: StoredCoverKeys): void {
  if (typeof window === "undefined") return;
  const next: StoredCoverKeys = {
    ...keys,
    configuredAt: keys.configuredAt || new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("restart-cover-keys"));
}

export function hasUsableCoverKeys(keys: StoredCoverKeys = loadCoverKeys()): boolean {
  if (keys.provider === "cloudflare") {
    return Boolean(keys.cloudflareAccountId?.trim() && keys.cloudflareToken?.trim());
  }
  if (keys.provider === "siliconflow") {
    return Boolean(keys.siliconflowKey?.trim());
  }
  return Boolean(keys.pollinationsKey?.trim());
}

/** Local `next dev` uses server CLOUDFLARE_* so you don't have to paste keys. */
export function usesLocalCoverFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** User keys, or the local-dev server fallback. Production still needs user keys. */
export function canGenerateAiCover(
  keys: StoredCoverKeys = loadCoverKeys(),
): boolean {
  return hasUsableCoverKeys(keys) || usesLocalCoverFallback();
}

export function toCoverCredentials(keys: StoredCoverKeys): CoverCredentials {
  return {
    provider: (keys.provider || "cloudflare") as CoverProvider,
    cloudflareAccountId: keys.cloudflareAccountId,
    cloudflareToken: keys.cloudflareToken,
    siliconflowKey: keys.siliconflowKey,
    pollinationsKey: keys.pollinationsKey,
  };
}
