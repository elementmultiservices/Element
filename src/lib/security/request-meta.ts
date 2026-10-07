import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/** Client IP as reported by the platform proxy (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIpFrom(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || h.get("x-real-ip")?.trim() || "";
  return isIP(candidate) ? candidate : null;
}

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return {
    ip: clientIpFrom(h),
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}
