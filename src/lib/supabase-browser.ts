"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAuthConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/cloud-env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(supabaseUrl(), supabaseAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
