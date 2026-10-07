import "server-only";
import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Keyed hash for identifiers (e.g. emails) used as rate-limit keys, so raw PII never reaches Redis. */
export function hashIdentifier(value: string): string {
  return createHmac("sha256", serverEnv().SESSION_SECRET).update(value.trim().toLowerCase()).digest("hex").slice(0, 40);
}
