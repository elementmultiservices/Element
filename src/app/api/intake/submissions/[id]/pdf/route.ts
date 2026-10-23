import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiError, authFailure } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/session";
import { formatBytes } from "@/lib/format";
import { intakePdfContent } from "@/lib/intake/content";
import { buildIntakePdf } from "@/lib/intake/pdf";
import { getIntakeSubmission, intakeReference } from "@/lib/intake/queries";
import { readIntakeObject } from "@/lib/intake/storage";
import { getSiteSettings } from "@/lib/site-settings";
import { intakeSummary } from "@/lib/intake/summary";
import { isAppLocale } from "@/i18n/routing";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/request-meta";
import { createClient } from "@/lib/supabase/server";

// Embedding up to 25 attachments can take a while.
export const maxDuration = 60;

/**
 * The complete intake as one PDF (answers, signed declaration and attached
 * PDFs/images), in English or Spanish (?lang=en|es). Administrators get full
 * tax IDs and bank numbers; the client's own copy shows them masked.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/intake/submissions/[id]/pdf">) {
  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { ctx } = auth;
  const { id } = await params;
  const lang = request.nextUrl.searchParams.get("lang");
  const locale = isAppLocale(lang) ? lang : ctx.locale;

  const meta = await requestMeta();
  if (!(await rateLimit("intakePdfUser", ctx.userId)).success) return apiError("rate_limited", 429);

  const found = await getIntakeSubmission(await createClient(), id);
  if (!found) return apiError("not_found", 404);
  const { submission, uploads } = found;
  const full = ctx.role === "admin";

  const t = await getTranslations({ locale, namespace: "Intake" });
  const siteName = (await getTranslations({ locale, namespace: "Metadata" }))("siteName");
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/New_York" }).format(
      new Date(iso),
    );

  const [signaturePng, spousePng, ...files] = await Promise.all([
    readIntakeObject(submission.signature_path),
    submission.spouse_signature_path ? readIntakeObject(submission.spouse_signature_path) : Promise.resolve(null),
    ...uploads.map((u) =>
      u.mime_type === "application/pdf" || u.mime_type.startsWith("image/") ? readIntakeObject(u.storage_path) : Promise.resolve(null),
    ),
  ]);

  const reference = intakeReference(submission.id);
  const content = intakePdfContent((key, values) => t(key as never, values as never), {
    year: submission.tax_year,
    name: submission.taxpayer_name,
    reference,
    submitted: dateTime(submission.signed_at),
    pub135: submission.pub135_acknowledged,
    agreement: submission.agreement_accepted,
  });
  const method = (m: string | null) => t(`signatureMethods.${m ?? "draw"}` as never);
  const pdf = await buildIntakePdf({
    businessName: siteName,
    footer: [t("pdf.footer"), (await getSiteSettings()).email].filter(Boolean).join(" · "),
    ...content,
    sections: intakeSummary(submission.data, (key, values) => t(key as never, values as never), { full }),
    attachments: uploads.map((u, i) => ({
      name: u.original_name,
      typeLabel: t(`docTypes.${u.doc_type}` as never),
      sizeLabel: formatBytes(u.size_bytes, locale),
      mime: u.mime_type,
      bytes: files[i] ?? null,
    })),
    signature: { name: submission.signer_name, png: signaturePng, method: method(submission.signature_method) },
    spouseSignature: submission.spouse_signer_name
      ? { name: submission.spouse_signer_name, png: spousePng, method: method(submission.spouse_signature_method) }
      : null,
    signedAt: dateTime(submission.signed_at),
    signerIp: full ? (submission.signer_ip as string | null) : null,
  });

  await audit(
    {
      actorId: ctx.userId,
      action: "intake.pdf_downloaded",
      targetType: "intake",
      targetId: submission.id,
      metadata: { owner_id: submission.owner_id, lang: locale },
    },
    meta,
  );

  const fileName = `intake-${submission.tax_year}-${reference}-${locale}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
