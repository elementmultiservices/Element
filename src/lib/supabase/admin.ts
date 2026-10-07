import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES RLS — use only in server code, after the
 * caller has been authorized, and only for operations that require it.
 * The `server-only` import makes the build fail if this reaches the client.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
