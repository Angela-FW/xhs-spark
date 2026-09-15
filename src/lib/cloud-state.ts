"use client";

import type { AppState } from "@/lib/store";
import { supabaseAnonKey, supabaseUrl } from "@/lib/cloud-env";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type CloudFlushFn = (state?: AppState) => Promise<void>;

let cloudFlushFn: CloudFlushFn | null = null;

export function registerPlannerCloudFlush(fn: CloudFlushFn | null) {
  cloudFlushFn = fn;
}

/** Push current (or given) planner state to the cloud immediately. */
export function flushPlannerCloud(state?: AppState): Promise<void> {
  return cloudFlushFn?.(state) ?? Promise.resolve();
}

export async function fetchCloudState(
  userId: string,
): Promise<{ data: AppState; updatedAt: string } | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data, error } = await sb
    .from("planner_state")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.data) return null;
  return {
    data: data.data as AppState,
    updatedAt: data.updated_at as string,
  };
}

export async function fetchCloudStateWithRetry(
  userId: string,
  attempts = 3,
): Promise<{ data: AppState; updatedAt: string } | null> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchCloudState(userId);
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => window.setTimeout(resolve, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("cloud pull failed");
}

export function subscribePlannerState(
  userId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabaseBrowser();
  if (!sb) return () => {};
  const channel = sb
    .channel(`planner_state:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "planner_state",
        filter: `user_id=eq.${userId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

export async function saveCloudState(
  userId: string,
  state: AppState,
): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("云端未配置");
  const updatedAt = new Date().toISOString();
  const row = {
    user_id: userId,
    data: state,
    updated_at: updatedAt,
  };

  const hidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";
  const payload = JSON.stringify(row);
  if (hidden && payload.length < 60_000) {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      const res = await fetch(
        `${supabaseUrl().replace(/\/$/, "")}/rest/v1/planner_state?on_conflict=user_id`,
        {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: supabaseAnonKey(),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: payload,
        },
      );
      if (res.ok) return updatedAt;
    }
  }

  const { data, error } = await sb
    .from("planner_state")
    .upsert(row, { onConflict: "user_id" })
    .select("updated_at")
    .single();
  if (error) throw new Error(error.message);
  return (data?.updated_at as string) || updatedAt;
}
