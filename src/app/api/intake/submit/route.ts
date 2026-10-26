import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { audit } from "@/lib/audit";
import { inspectFile } from "@/lib/files/inspect";
import { actorColumn, actorFolder, actorId, intakeActor } from "@/lib/intake/actor";
import { linkIdLast4 } from "@/lib/intake/link";
import { intakeReference } from "@/lib/intake/queries";
import {
  intakeDataSchema,
  intakeErrorsFrom,
  intakeSigningSchema,
  intakeSubmitSchema,
  MAX_SIGNATURE_BYTES,
  taxYearOptions,
} from "@/lib/intake/schema";
import { INTAKE_BUCKET } from "@/lib/intake/storage";
import { hashIdentifier } from "@/lib/security/hash";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { requestMeta } from "@/lib/security/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";

/** Decodes a drawn signature (PNG data URL) and checks it really is a small PNG image. */
function decodeSignature(dataUrl: string): Uint8Array | null {
  const base64 = dataUrl.slice("data:image/png;base64,".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const buf = new Uint8Array(Buffer.from(base64, "base64"));
  if (buf.byteLength === 0 || buf.byteLength > MAX_SIGNATURE_BYTES) return null;
  return inspectFile(buf, "png").ok ? buf : null;
}

/** What a bot caught by a trap receives: looks like success, stores nothing. */
function decoy() {
  const id = crypto.randomUUID();
  return apiOk({ id, reference: intakeReference(id) }, 201);
}

/**
 * Receives a completed intake form: answers, drawn signature(s) and the ids of
 * documents uploaded (and verified) beforehand. Everything is validated again
 * here; the documents are then attached to the new submission.
 *
 * Signed-in clients (session, same origin, per-user rate limit) own the form
 * right away. The public form (draft token, no account) leaves it unassigned
 * until staff assign it, and is guarded against spam with a honeypot, the
 * draft's time trap, reCAPTCHA, per-IP and per-email limits and single use of
 * each draft. A failed reCAPTCHA is reported (not faked) so a person can retry
 * without losing ten minutes of answers. Nothing is emailed to the typed
 * address, so the form cannot be used to send mail to strangers.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("forbidden", 403);

  const found = await intakeActor(request);
  if ("response" in found) return found.response;
  const { actor } = found;
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

  if (actor.kind === "user") {
    if (!(await rateLimit("intakeSubmitUser", actor.userId)).success) return apiError("rate_limited", 429);
  } else {
    // Honeypot and time trap: real visitors never fill the hidden field nor finish in under a minute.
    if (input.website.trim() !== "" || actor.fast) return decoy();
    if (!(await verifyRecaptcha(input.recaptchaToken, "intake_submit", meta.ip))) return apiError("recaptcha_failed", 403);
    if (!(await rateLimit("intakePublicSubmitIp", meta.ip)).success) return apiError("rate_limited", 429);
    if (!(await rateLimit("intakePublicSubmitDailyIp", meta.ip)).success) return apiError("rate_limited", 429);
  }

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
  const contactEmail = answers.taxpayer.email.toLowerCase();
  if (actor.kind === "draft" && !(await rateLimit("intakePublicSubmitEmail", hashIdentifier(contactEmail))).success) {
    return apiError("rate_limited", 429);
  }

  const signature = decodeSignature(signing.data.signature);
  const withSpouse = signing.data.spouseSignature.length > 0 && answers.filingStatus === "mfj";
  const spouseSignature = withSpouse ? decodeSignature(signing.data.spouseSignature) : null;
  if (!signature || (withSpouse && !spouseSignature)) {
    return apiOk({ error: "intake_invalid", fields: { [signature ? "spouseSignature" : "signature"]: "signatureRequired" } }, 422);
  }

  const admin = createAdminClient();
  const [column, value] = actorColumn(actor);
  const uploadIds = [...new Set(input.uploadIds)];
  if (uploadIds.length > 0) {
    const { data: uploads } = await admin
      .from("intake_uploads")
      .select("id")
      .in("id", uploadIds)
      .eq(column, value)
      .is("submission_id", null)
      .not("checksum_sha256", "is", null)
      .gt("expires_at", new Date().toISOString());
    if ((uploads?.length ?? 0) !== uploadIds.length) return apiError("intake_uploads_invalid", 409);
  }

  const submissionId = crypto.randomUUID();
  const storage = admin.storage.from(INTAKE_BUCKET);
  const folder = `${actorFolder(actor)}/${submissionId}`;
  const signaturePath = `${folder}/signature.png`;
  const spousePath = spouseSignature ? `${folder}/spouse-signature.png` : null;
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
    owner_id: actor.kind === "user" ? actor.userId : null,
    draft_id: actor.kind === "draft" ? actor.draftId : null,
    contact_email: contactEmail,
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
    await rollback();
    // The draft was already submitted (double click or replay): nothing new is stored.
    if (insertError.code === "23505" && actor.kind === "draft") return decoy();
    console.error(`[intake] submission insert failed: ${insertError.code}`);
    return apiError("server_error", 500);
  }

  if (uploadIds.length > 0) {
    const { data: attached, error: attachError } = await admin
      .from("intake_uploads")
      .update({ submission_id: submissionId })
      .in("id", uploadIds)
      .eq(column, value)
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

  const idLink =
    actor.kind === "user" ? await linkIdLast4({ userId: actor.userId, last4: t.ssn.slice(-4), submissionId, actorId: actor.userId }, meta) : "unassigned";

  await audit(
    {
      actorId: actorId(actor),
      action: "intake.submitted",
      targetType: "intake",
      targetId: submissionId,
      metadata: {
        tax_year: answers.taxYear,
        source: actor.kind === "user" ? "account" : "public",
        signature_method: signing.data.signatureMethod,
        documents: uploadIds.length,
        spouse_signed: Boolean(spousePath),
        id_last4: idLink,
      },
    },
    meta,
  );

  return apiOk({ id: submissionId, reference: intakeReference(submissionId) }, 201);
}
