import { NextResponse } from "next/server";
import { isLocalCoverFallback } from "@/lib/cover-server";

export const runtime = "nodejs";

/**
 * Production: always false — users must paste their own SiliconFlow key.
 * Local `next dev`: true only if this machine has SILICONFLOW_API_KEY.
 */
export async function GET() {
  if (!isLocalCoverFallback()) {
    return NextResponse.json({ siliconflow: false });
  }
  return NextResponse.json({
    siliconflow: Boolean(process.env.SILICONFLOW_API_KEY?.trim()),
  });
}
