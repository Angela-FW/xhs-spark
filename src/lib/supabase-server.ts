import { createClient, type User } from "@supabase/supabase-js";
import {
  isAuthConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/cloud-env";

export async function getUserFromRequest(
  req: Request,
): Promise<User | null> {
  if (!isAuthConfigured()) return null;
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token) return null;

  const supabase = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * AI routes allow anonymous use; client asks for login after free quota.
 * When a Bearer token is present, attach the user for future per-account limits.
 */
export async function requireUserForAi(
  req: Request,
): Promise<{ ok: true; user: User | null } | { ok: false; response: Response }> {
  if (!isAuthConfigured()) {
    return { ok: true, user: null };
  }
  const user = await getUserFromRequest(req);
  return { ok: true, user };
}
