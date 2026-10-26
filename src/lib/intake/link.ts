import "server-only";
import { audit } from "@/lib/audit";
import type { RequestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";

export type IdLinkResult = "linked" | "same" | "mismatch" | "unavailable";

/**
 * Links an account to the taxpayer's tax ID: the last four digits of the
 * SSN/ITIN typed in a form are stored on the profile when it has none yet
 * (when the client submits it, or when staff assign the form to the account).
 * Digits already on file (set by staff or an import) are never overwritten; a
 * difference is recorded so staff can check it on the form.
 */
export async function linkIdLast4(
  input: { userId: string; last4: string; submissionId: string; actorId: string | null },
  meta?: RequestMeta,
): Promise<IdLinkResult> {
  const { userId, last4, submissionId, actorId } = input;
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("id_last4").eq("id", userId).maybeSingle();
  if (error || !profile) {
    // e.g. migration 20261023000200 not applied yet: the form is still accepted.
    console.error(`[intake] id_last4 read failed: ${error?.code ?? "no_profile"}`);
    return "unavailable";
  }
  if (profile.id_last4 === last4) return "same";
  if (profile.id_last4) {
    await audit(
      { actorId, action: "intake.id_last4_mismatch", targetType: "intake", targetId: submissionId, metadata: { on_file: profile.id_last4, in_form: last4, user_id: userId } },
      meta,
    );
    return "mismatch";
  }

  // Only fills an empty value, even if two forms race.
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ id_last4: last4 })
    .eq("id", userId)
    .is("id_last4", null)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    if (updateError) console.error(`[intake] id_last4 update failed: ${updateError.code}`);
    return "unavailable";
  }
  await audit(
    { actorId, action: "user.id_last4.changed", targetType: "user", targetId: userId, metadata: { from: null, to: last4, source: "intake", submission_id: submissionId } },
    meta,
  );
  return "linked";
}
