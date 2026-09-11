import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Cover generation no longer uses shared site keys.
 * Kept for older clients; always reports unavailable server fallback.
 */
export async function GET() {
  return NextResponse.json({
    cloudflare: false,
    siliconflow: false,
    pollinations: false,
  });
}
