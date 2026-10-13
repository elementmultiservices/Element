import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { unsubscribeByToken } from "@/actions/newsletter";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/request-meta";

/**
 * One-click unsubscribe (RFC 8058): mail providers POST here from the
 * List-Unsubscribe header without any cookies or origin. The random per-
 * subscriber token is the only credential, so no origin check applies.
 */
export async function POST(request: NextRequest) {
  const meta = await requestMeta();
  if (!(await rateLimit("newsletterUnsubscribeIp", meta.ip)).success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const token = z.uuid().safeParse(request.nextUrl.searchParams.get("token"));
  if (!token.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const ok = await unsubscribeByToken(token.data);
  return NextResponse.json(ok ? { ok: true } : { error: "invalid" }, { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
