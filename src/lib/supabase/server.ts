import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { hardenCookie } from "./cookies";
import type { Database } from "./database.types";

/**
 * Supabase client bound to the current user's session (RLS applies).
 * Create one per request; never share across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = serverEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookie(options));
          }
        } catch {
          // Called from a Server Component: cookies are read-only there. The
          // proxy refreshes the session, so this can be safely ignored.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
