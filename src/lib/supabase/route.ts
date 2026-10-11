import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { hardenCookie } from "./cookies";
import type { Database } from "./database.types";

type PendingCookie = { name: string; value: string; options: Parameters<typeof hardenCookie>[0] };

/**
 * Supabase client for route handlers that answer with a redirect. Cookies the
 * client sets (PKCE verifier, session) are collected and copied onto the
 * response with `applyCookies`, so they survive the redirect.
 */
export function createRouteClient(request: NextRequest) {
  const env = serverEnv();
  const pending: PendingCookie[] = [];

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pending.push(cookie);
        }
      },
    },
  });

  function applyCookies(response: NextResponse): NextResponse {
    for (const { name, value, options } of pending) response.cookies.set(name, value, hardenCookie(options));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return { supabase, applyCookies };
}
