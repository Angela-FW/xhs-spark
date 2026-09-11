"use client";

import { getSupabaseBrowser } from "@/lib/supabase-browser";

/** Attach Authorization when the user is logged in (for AI APIs). */
export async function withAuthHeaders(
  headers: HeadersInit = {},
): Promise<HeadersInit> {
  const sb = getSupabaseBrowser();
  if (!sb) return headers;
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
