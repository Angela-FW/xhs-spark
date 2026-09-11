"use client";

import type { AppState } from "@/lib/store";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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

export async function saveCloudState(
  userId: string,
  state: AppState,
): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("云端未配置");
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from("planner_state").upsert(
    {
      user_id: userId,
      data: state,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return updatedAt;
}
