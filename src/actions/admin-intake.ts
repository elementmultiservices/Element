"use server";

import { z } from "zod";
import { inviteClient } from "@/lib/admin/invite";
import { getUser } from "@/lib/admin/queries";
import { audit } from "@/lib/audit";
import { requireAdmin, type SessionContext } from "@/lib/auth/session";
import { DEFAULT_QUOTA_BYTES } from "@/lib/files/rules";
import type { FormState } from "@/lib/forms";
import { linkIdLast4 } from "@/lib/intake/link";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/admin";

async function setReviewed(formData: FormData, reviewed: boolean): Promise<FormState<never>> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminActionUser", session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_submissions")
    .update({
      status: reviewed ? "reviewed" : "new",
      reviewed_by: reviewed ? session.userId : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[intake] status update failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({ actorId: session.userId, action: reviewed ? "intake.reviewed" : "intake.reopened", targetType: "intake", targetId: data.id });
  return { status: "success" };
}

export async function markIntakeReviewedAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  return setReviewed(formData, true);
}

export async function reopenIntakeAction(_prev: FormState<never>, formData: FormData): Promise<FormState<never>> {
  return setReviewed(formData, false);
}

// ---------------------------------------------------------------------------
// Assignment. Forms sent from the public page belong to nobody until staff
// assign them to a client account: the one using the email typed in the form,
// another existing account, or a new account invited with that email. The
// documents follow the form; the account then sees it in its dashboard. Only
// the owner changes, never the signed answers.
// ---------------------------------------------------------------------------
type Result = FormState<never>;

async function guard(): Promise<{ ok: true; session: SessionContext } | { ok: false; result: Result }> {
  const session = await requireAdmin();
  if (!(await rateLimit("adminIntakeAssignUser", session.userId)).success) return { ok: false, result: { status: "error", error: "rateLimited" } };
  return { ok: true, session };
}

/** The submission as staff see it (RLS: administrators only). */
async function findSubmission(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("intake_submissions").select("id, owner_id, contact_email, taxpayer_name, locale, data").eq("id", id).maybeSingle();
  return data;
}

async function setOwner(adminId: string, submissionId: string, from: string | null, to: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const stamp = to ? { assigned_by: adminId, assigned_at: new Date().toISOString() } : { assigned_by: null, assigned_at: null };
  // Compare-and-set on the previous owner so two admins cannot assign the same form at once.
  let query = admin.from("intake_submissions").update({ owner_id: to, ...stamp }).eq("id", submissionId);
  query = from ? query.eq("owner_id", from) : query.is("owner_id", null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    if (error) console.error(`[intake] assignment failed: ${error.code}`);
    return false;
  }
  const { error: uploadsError } = await admin.from("intake_uploads").update({ owner_id: to }).eq("submission_id", submissionId);
  if (uploadsError) console.error(`[intake] documents owner update failed: ${uploadsError.code}`);
  return true;
}

async function assignTo(session: SessionContext, submissionId: string, userId: string, how: "existing" | "invited"): Promise<Result> {
  const submission = await findSubmission(submissionId);
  if (!submission) return { status: "error", error: "notFound" };
  if (submission.owner_id === userId) return { status: "success" };

  const supabase = await createClient();
  const user = await getUser(supabase, userId);
  if (!user || user.role !== "user") return { status: "error", error: "intakeAssignInvalid" };
  if (!user.isActive) return { status: "error", error: "userInactive" };

  if (!(await setOwner(session.userId, submissionId, submission.owner_id, userId))) return { status: "error", error: "intakeAssignConflict" };

  const meta = await requestMeta();
  const ssn = (submission.data as { taxpayer?: { ssn?: string } } | null)?.taxpayer?.ssn ?? "";
  const idLink = /^\d{3}-\d{2}-\d{4}$/.test(ssn)
    ? await linkIdLast4({ userId, last4: ssn.slice(-4), submissionId, actorId: session.userId }, meta)
    : "unavailable";
  await audit(
    {
      actorId: session.userId,
      action: "intake.assigned",
      targetType: "intake",
      targetId: submissionId,
      metadata: {
        from: submission.owner_id,
        to: userId,
        how,
        email_match: user.email.toLowerCase() === (submission.contact_email ?? "").toLowerCase(),
        id_last4: idLink,
      },
    },
    meta,
  );
  return { status: "success" };
}

const assignSchema = z.object({ id: z.uuid(), userId: z.uuid() });

/** Assigns the form to an existing client account (the matching email, or one chosen by staff). */
export async function assignIntakeAction(_prev: Result, formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g.result;
  const parsed = assignSchema.safeParse({ id: formData.get("id"), userId: formData.get("userId") });
  if (!parsed.success) return { status: "error", error: parsed.error.issues.some((i) => i.path[0] === "userId") ? "intakeAssignInvalid" : "notFound" };
  return assignTo(g.session, parsed.data.id, parsed.data.userId, "existing");
}

/**
 * Creates a client account with the email typed in the form (name and language
 * from the form too), emails its invitation and assigns the form to it.
 */
export async function inviteAndAssignIntakeAction(_prev: Result, formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g.result;
  if (!(await rateLimit("adminInviteUser", g.session.userId)).success) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const submission = await findSubmission(parsed.data.id);
  if (!submission) return { status: "error", error: "notFound" };
  if (submission.owner_id) return { status: "error", error: "intakeAssignConflict" };
  const email = z.email().safeParse(submission.contact_email ?? "");
  if (!email.success) return { status: "error", error: "intakeAssignInvalid" };

  const preferred = (submission.data as { preferredLanguage?: string } | null)?.preferredLanguage;
  const invited = await inviteClient(
    {
      adminId: g.session.userId,
      fullName: submission.taxpayer_name.slice(0, 120),
      email: email.data,
      locale: preferred === "es" || preferred === "en" ? preferred : submission.locale,
      quotaMb: DEFAULT_QUOTA_BYTES / (1024 * 1024),
      source: "intake",
    },
    await requestMeta(),
  );
  if (!invited.ok) return { status: "error", error: invited.error };

  const assigned = await assignTo(g.session, submission.id, invited.userId, "invited");
  if (assigned.status !== "success") return assigned;
  return invited.sent ? { status: "success" } : { status: "error", error: "deliveryFailed" };
}

/** Takes the form away from its account (e.g. assigned by mistake); it goes back to the unassigned list. */
export async function unassignIntakeAction(_prev: Result, formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g.result;
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const submission = await findSubmission(parsed.data.id);
  if (!submission) return { status: "error", error: "notFound" };
  if (!submission.owner_id) return { status: "success" };
  if (!(await setOwner(g.session.userId, submission.id, submission.owner_id, null))) return { status: "error", error: "intakeAssignConflict" };

  await audit({ actorId: g.session.userId, action: "intake.unassigned", targetType: "intake", targetId: submission.id, metadata: { from: submission.owner_id } });
  return { status: "success" };
}
