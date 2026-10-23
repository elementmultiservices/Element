import type { NextRequest } from "next/server";
import { apiError, apiOk, authFailure } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { inspectFile } from "@/lib/files/inspect";
import {
  intakeDataSchema,
  intakeErrorsFrom,
  intakeSigningSchema,
  intakeSubmitSchema,
  MAX_SIGNATURE_BYTES,
  taxYearOptions,
} from "@/lib/intake/schema";
import { INTAKE_BUCKET } from "@/lib/intake/storage";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { requestMeta, type RequestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Links the account to the taxpayer's tax ID: the last four digits of the
 * SSN/ITIN typed in the form are stored on the profile when it has none yet.
 * Digits already on file (set by staff or an import) are never overwritten; a
 * difference is recorded so staff can check it on the form.
 */
async function linkIdLast4(userId: string, last4: string, submissionId: string, meta: RequestMeta): Promise<"linked" | "same" | "mismatch" | "unavailable"> {
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
      { actorId: userId, action: "intake.id_last4_mismatch", targetType: "intake", targetId: submissionId, metadata: { on_file: profile.id_last4, in_form: last4 } },
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
    { actorId: userId, action: "user.id_last4.changed", targetType: "user", targetId: userId, metadata: { from: null, to: last4, source: "intake", submission_id: submissionId } },
    meta,
  );
  return "linked";
}

/** Decodes a drawn signature (PNG data URL) and checks it really is a small PNG image. */
function decodeSignature(dataUrl: string): Uint8Array | null {
  const base64 = dataUrl.slice("data:image/png;base64,".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const buf = new Uint8Array(Buffer.from(base64, "base64"));
  if (buf.byteLength === 0 || buf.byteLength > MAX_SIGNATURE_BYTES) return null;
  return inspectFile(buf, "png").ok ? buf : null;
}

/**
 * Receives a completed intake form: answers, drawn signature(s) and the ids of
 * documents uploaded (and verified) beforehand. Everything is validated again
 * here; the documents are then attached to the new submission. No reCAPTCHA:
 * the caller is signed in (session, same origin, per-user rate limit), and a
 * low score after a long form would throw away ten minutes of answers.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("forbidden", 403);

  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  if (ctx.role !== "user") return apiError("forbidden", 403);
  const meta = await requestMeta();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", 400);
  }
  const parsed = intakeSubmitSchema.safeParse(body);
  if (!parsed.success) return apiError("bad_request", 400);
  const input = parsed.data;

  if (!(await rateLimit("intakeSubmitUser", ctx.userId)).success) return apiError("rate_limited", 429);

  const data = intakeDataSchema.safeParse(input.data);
  const signing = intakeSigningSchema.safeParse({
    filingStatus: data.success ? data.data.filingStatus : "single",
    consent: input.consent,
    pub135: input.pub135,
    agreement: input.agreement,
    signature: input.signature,
    signatureMethod: input.signatureMethod,
    spouseSignature: input.spouseSignature,
    spouseSignatureMethod: input.spouseSignatureMethod,
  });
  if (!data.success || !signing.success) {
    const fields = { ...(data.success ? {} : intakeErrorsFrom(data.error)), ...(signing.success ? {} : intakeErrorsFrom(signing.error)) };
    return apiOk({ error: "intake_invalid", fields }, 422);
  }
  const answers = data.data;
  if (!taxYearOptions().includes(answers.taxYear)) return apiOk({ error: "intake_invalid", fields: { taxYear: "choose" } }, 422);

  const signature = decodeSignature(signing.data.signature);
  const withSpouse = signing.data.spouseSignature.length > 0 && answers.filingStatus === "mfj";
  const spouseSignature = withSpouse ? decodeSignature(signing.data.spouseSignature) : null;
  if (!signature || (withSpouse && !spouseSignature)) {
    return apiOk({ error: "intake_invalid", fields: { [signature ? "spouseSignature" : "signature"]: "signatureRequired" } }, 422);
  }

  const admin = createAdminClient();
  const uploadIds = [...new Set(input.uploadIds)];
  if (uploadIds.length > 0) {
    const { data: uploads } = await admin
      .from("intake_uploads")
      .select("id")
      .in("id", uploadIds)
      .eq("owner_id", ctx.userId)
      .is("submission_id", null)
      .not("checksum_sha256", "is", null)
      .gt("expires_at", new Date().toISOString());
    if ((uploads?.length ?? 0) !== uploadIds.length) return apiError("intake_uploads_invalid", 409);
  }

  const submissionId = crypto.randomUUID();
  const storage = admin.storage.from(INTAKE_BUCKET);
  const signaturePath = `intake/${ctx.userId}/${submissionId}/signature.png`;
  const spousePath = spouseSignature ? `intake/${ctx.userId}/${submissionId}/spouse-signature.png` : null;
  const written: string[] = [];
  const rollback = async () => {
    if (written.length > 0) await storage.remove(written);
  };

  for (const [path, bytes] of [
    [signaturePath, signature],
    [spousePath, spouseSignature],
  ] as const) {
    if (!path || !bytes) continue;
    const { error } = await storage.upload(path, bytes, { contentType: "image/png", upsert: false });
    if (error) {
      console.error("[intake] signature upload failed");
      await rollback();
      return apiError("server_error", 500);
    }
    written.push(path);
  }

  const t = answers.taxpayer;
  const s = answers.spouse;
  const fullName = (p: { firstName: string; middleInitial: string; lastName: string }) =>
    [p.firstName, p.middleInitial, p.lastName].filter(Boolean).join(" ");
  const { error: insertError } = await admin.from("intake_submissions").insert({
    id: submissionId,
    owner_id: ctx.userId,
    tax_year: answers.taxYear,
    locale: input.locale,
    taxpayer_name: fullName(t),
    filing_status: answers.filingStatus,
    data: answers,
    signer_name: fullName(t),
    signature_path: signaturePath,
    signature_method: signing.data.signatureMethod,
    spouse_signer_name: spousePath && s ? fullName(s) : null,
    spouse_signature_path: spousePath && s ? spousePath : null,
    spouse_signature_method: spousePath && s ? signing.data.spouseSignatureMethod || null : null,
    pub135_acknowledged: signing.data.pub135,
    agreement_accepted: signing.data.agreement,
    signer_ip: meta.ip,
    signer_user_agent: meta.userAgent,
  });
  if (insertError) {
    console.error(`[intake] submission insert failed: ${insertError.code}`);
    await rollback();
    return apiError("server_error", 500);
  }

  if (uploadIds.length > 0) {
    const { data: attached, error: attachError } = await admin
      .from("intake_uploads")
      .update({ submission_id: submissionId })
      .in("id", uploadIds)
      .eq("owner_id", ctx.userId)
      .is("submission_id", null)
      .select("id");
    if (attachError || (attached?.length ?? 0) !== uploadIds.length) {
      console.error(`[intake] attach failed: ${attachError?.code ?? "count_mismatch"}`);
      await admin.from("intake_uploads").update({ submission_id: null }).eq("submission_id", submissionId);
      await admin.from("intake_submissions").delete().eq("id", submissionId);
      await rollback();
      return apiError("intake_uploads_invalid", 409);
    }
  }

  const idLink = await linkIdLast4(ctx.userId, t.ssn.slice(-4), submissionId, meta);

  await audit(
    {
      actorId: ctx.userId,
      action: "intake.submitted",
      targetType: "intake",
      targetId: submissionId,
      metadata: { tax_year: answers.taxYear, signature_method: signing.data.signatureMethod, documents: uploadIds.length, spouse_signed: Boolean(spousePath), id_last4: idLink },
    },
    meta,
  );

  return apiOk({ id: submissionId }, 201);
}
