import { createHmac, randomInt } from "node:crypto";

/**
 * MFA recovery code format: 10 characters from an unambiguous 31-symbol
 * alphabet (no 0/O, 1/I/L), shown as "XXXXX-XXXXX" — about 49 bits of entropy each.
 */
export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 symbols
const LENGTH = 10;

export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < LENGTH; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Uppercases and removes separators/spaces; returns null if it cannot be a code. */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

/** Keyed hash bound to the user, so a leaked hash table cannot be brute-forced offline without the secret. */
export function hashRecoveryCode(secret: string, userId: string, normalized: string): string {
  return createHmac("sha256", secret).update(`mfa-recovery:${userId}:${normalized}`).digest("hex");
}
