import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

/**
 * Anonymous client for public content (blog, sitemap). It never carries a user
 * session, so public pages show exactly what an anonymous visitor may see,
 * even when an administrator is signed in.
 */
export function createPublicClient() {
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
