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
 * When auth is configured, require a valid user.
 * When not configured (local/dev), allow through.
 */
export async function requireUserForAi(
  req: Request,
): Promise<{ ok: true; user: User | null } | { ok: false; response: Response }> {
  if (!isAuthConfigured()) {
    return { ok: true, user: null };
  }
  const user = await getUserFromRequest(req);
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "请先登录后再使用生成功能" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}
