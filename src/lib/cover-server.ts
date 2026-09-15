/**
 * Cover credentials.
 * Production: each signed-in user must send their own SiliconFlow key.
 * Local `next dev` may fall back to SILICONFLOW_API_KEY in .env.local for the
 * developer only — never used as a shared site quota.
 */

export function isLocalCoverFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function resolveSiliconflowKey(userKey: string | undefined): string {
  const fromUser = userKey?.trim() || "";
  if (fromUser) return fromUser;
  if (!isLocalCoverFallback()) return "";
  return process.env.SILICONFLOW_API_KEY?.trim() || "";
}

export function missingSiliconflowKeyMessage(): string {
  if (isLocalCoverFallback()) {
    return "本地未配置硅基流动：请在页面填写你的 API Key，或在 .env.local 增加 SILICONFLOW_API_KEY（仅本机自用）。";
  }
  return "未配置生图 Key：请在生成页填写你自己的硅基流动 API Key（登录后会同步到账号，不占用别人额度）。";
}
