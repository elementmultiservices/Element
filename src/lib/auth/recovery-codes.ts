import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode, RECOVERY_CODE_COUNT } from "./recovery-code-format";

/**
 * Replaces the user's recovery codes with a fresh set and returns the
 * plaintext codes. They are never stored or logged; the caller shows them once.
 */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const secret = serverEnv().SESSION_SECRET;
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const admin = createAdminClient();
  await admin.from("mfa_recovery_codes").delete().eq("user_id", userId);
  const { error } = await admin.from("mfa_recovery_codes").insert(
    codes.map((code) => ({ user_id: userId, code_hash: hashRecoveryCode(secret, userId, normalizeRecoveryCode(code)!) })),
  );
  if (error) throw new Error(`[mfa] recovery code insert failed: ${error.code}`);
  return codes;
}

/** Marks a code as used if it is valid and unused. */
export async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (!normalized) return false;
  const hash = hashRecoveryCode(serverEnv().SESSION_SECRET, userId, normalized);
  const { data, error } = await createAdminClient().rpc("consume_recovery_code", { p_user: userId, p_hash: hash });
  if (error) {
    console.error(`[mfa] consume failed: ${error.code}`);
    return false;
  }
  return data === true;
}

export async function deleteRecoveryCodes(userId: string): Promise<void> {
  await createAdminClient().from("mfa_recovery_codes").delete().eq("user_id", userId);
}

/**
 * Removes every MFA factor of the user and revokes ALL their sessions
 * explicitly (not relying on Auth doing it), so no other device keeps access.
 */
export async function resetMfaFactors(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) return false;
  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (deleteError) return false;
  }
  await deleteRecoveryCodes(userId);
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user: userId });
  if (revokeError) {
    console.error(`[mfa] session revocation failed: ${revokeError.code}`);
    return false;
  }
  return true;
}
