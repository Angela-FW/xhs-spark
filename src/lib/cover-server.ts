/**
 * Cover credentials for API routes.
 * Production never uses shared site keys — users must paste their own.
 * Local `next dev` may fall back to CLOUDFLARE_* already used for text gen.
 */

export function isLocalCoverFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function localCloudflareCoverCreds(): {
  accountId: string;
  token: string;
} {
  if (!isLocalCoverFallback()) return { accountId: "", token: "" };
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "",
    token: process.env.CLOUDFLARE_API_TOKEN?.trim() || "",
  };
}

export function resolveCloudflareCoverCreds(input: {
  accountId?: string;
  token?: string;
}): { accountId: string; token: string } {
  const accountId = input.accountId?.trim() || "";
  const token = input.token?.trim() || "";
  if (accountId && token) return { accountId, token };
  return localCloudflareCoverCreds();
}

export function resolveCoverApiKey(
  userKey: string | undefined,
  envName: "SILICONFLOW_API_KEY" | "POLLINATIONS_API_KEY",
): string {
  const fromUser = userKey?.trim() || "";
  if (fromUser) return fromUser;
  if (!isLocalCoverFallback()) return "";
  return process.env[envName]?.trim() || "";
}
