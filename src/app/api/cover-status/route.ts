import { NextResponse } from "next/server";
import { isLocalCoverFallback, localCloudflareCoverCreds } from "@/lib/cover-server";

export const runtime = "nodejs";

/**
 * Production: no shared site keys (users configure their own).
 * Local `next dev`: report CLOUDFLARE_* from .env.local as a cover fallback.
 */
export async function GET() {
  if (!isLocalCoverFallback()) {
    return NextResponse.json({
      cloudflare: false,
      siliconflow: false,
      pollinations: false,
    });
  }
  const cf = localCloudflareCoverCreds();
  return NextResponse.json({
    cloudflare: Boolean(cf.accountId && cf.token),
    siliconflow: Boolean(process.env.SILICONFLOW_API_KEY?.trim()),
    pollinations: Boolean(process.env.POLLINATIONS_API_KEY?.trim()),
  });
}
