"use server";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { rateLimit } from "@/lib/security/rate-limit";
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
