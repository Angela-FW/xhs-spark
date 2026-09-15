"use client";

import type { CoverCredentials } from "@/lib/cover-image";

const STORAGE_KEY = "restart-cover-keys-v1";

export type StoredCoverKeys = CoverCredentials & {
  /** User skipped or saved empty — treat as not ready for AI covers. */
  configuredAt?: string;
};

export const SILICONFLOW_KEY_LINK = {
  label: "硅基流动",
  href: "https://cloud.siliconflow.cn",
  help: "注册并完成实名后，创建 API Key。免费调用 Kolors（有每日上限）。每人一把 Key，登录后只同步到你自己的账号。",
} as const;

export function loadCoverKeys(): StoredCoverKeys {
  if (typeof window === "undefined") {
    return { siliconflowKey: "" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { siliconflowKey: "" };
    const parsed = JSON.parse(raw) as StoredCoverKeys;
    return {
      siliconflowKey: parsed.siliconflowKey || "",
      configuredAt: parsed.configuredAt,
    };
  } catch {
    return { siliconflowKey: "" };
  }
}

export function saveCoverKeys(keys: StoredCoverKeys): void {
  if (typeof window === "undefined") return;
  const next: StoredCoverKeys = {
    siliconflowKey: keys.siliconflowKey || "",
    configuredAt: keys.configuredAt || new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("restart-cover-keys"));
}

export function hasUsableCoverKeys(keys: StoredCoverKeys = loadCoverKeys()): boolean {
  return Boolean(keys.siliconflowKey?.trim());
}

/** Local `next dev` may use SILICONFLOW_API_KEY in .env.local (this machine only). */
export function usesLocalCoverFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** User keys, or the local-dev server fallback. Production still needs each user's key. */
export function canGenerateAiCover(
  keys: StoredCoverKeys = loadCoverKeys(),
): boolean {
  return hasUsableCoverKeys(keys) || usesLocalCoverFallback();
}

export function toCoverCredentials(keys: StoredCoverKeys): CoverCredentials {
  return { siliconflowKey: keys.siliconflowKey };
}
