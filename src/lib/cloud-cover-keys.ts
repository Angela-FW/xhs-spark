"use client";

import type { StoredCoverKeys } from "@/lib/cover-keys";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type CloudCoverKeysRow = {
  provider: string | null;
  siliconflow_key: string | null;
  configured_at: string | null;
  updated_at: string;
};

function rowToKeys(row: CloudCoverKeysRow): StoredCoverKeys {
  return {
    siliconflowKey: row.siliconflow_key || "",
    configuredAt: row.configured_at || row.updated_at || undefined,
  };
}

export async function fetchCloudCoverKeys(
  userId: string,
): Promise<StoredCoverKeys | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data, error } = await sb
    .from("user_cover_keys")
    .select("provider, siliconflow_key, configured_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToKeys(data as CloudCoverKeysRow);
}

export async function saveCloudCoverKeys(
  userId: string,
  keys: StoredCoverKeys,
): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("云端未配置");
  const updatedAt = new Date().toISOString();
  const configuredAt = keys.configuredAt || updatedAt;
  const { error } = await sb.from("user_cover_keys").upsert(
    {
      user_id: userId,
      provider: "siliconflow",
      siliconflow_key: keys.siliconflowKey?.trim() || "",
      cloudflare_account_id: "",
      cloudflare_token: "",
      pollinations_key: "",
      configured_at: configuredAt,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return updatedAt;
}
