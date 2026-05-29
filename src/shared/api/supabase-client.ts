import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLegacyApp } from "../platform/legacy-app";

let browserClient: SupabaseClient | null = null;

export function getProductSupabaseClient(): SupabaseClient | null {
  if (browserClient) return browserClient;

  const legacyApp = getLegacyApp();
  const supabaseUrl = legacyApp.config?.SUPABASE_URL;
  const publishableKey = legacyApp.config?.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) return null;

  browserClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return browserClient;
}
