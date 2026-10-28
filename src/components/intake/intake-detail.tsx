import { CheckCircle2, Download, FileText, XCircle } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { sanitizeDisplayName } from "@/lib/files/rules";
import type { IntakeSubmission, IntakeUpload } from "@/lib/intake/queries";
import { intakeSummary } from "@/lib/intake/summary";

/** PDF download buttons, one per language. */
export async function IntakePdfButtons({ id }: { id: string }) {
  const t = await getTranslations("Intake.detail");
  return (
    <div className="flex flex-wrap gap-2">
      {(["en", "es"] as const).map((lang) => (
        <Button key={lang} asChild variant={lang === "en" ? "default" : "outline"} size="sm">
          <a href={`/api/intake/submissions/${id}/pdf?lang=${lang}`} download>
            <Download aria-hidden="true" />
            {t(`pdf.${lang}`)}
          </a>
        </Button>
      ))}
    </div>
  );
}

/**
 * Read-only view of a submitted intake form. Administrators see full tax IDs
 * and bank numbers (`full`); clients see them masked.
 */
export async function IntakeDetail({
  submission,
  uploads,
  full,
}: {
  submission: IntakeSubmission;
  uploads: IntakeUpload[];
  full: boolean;
}) {
  const t = await getTranslations("Intake");
  const format = await getFormatter();
  const locale = await getLocale();
  const sections = intakeSummary(submission.data, (key, values) => t(key as never, values as never), { full });

  const signatures = [
    { who: "taxpayer", name: submission.signer_name, method: submission.signature_method },
    ...(submission.spouse_signer_name
      ? [{ who: "spouse", name: submission.spouse_signer_name, method: submission.spouse_signature_method ?? "draw" }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.title} className="rounded-[24px] border border-azure-50 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">{section.title}</h2>
          <dl className="divide-y divide-azure-50">
            {section.rows.map((row, i) => (
              <div key={`${row.label}-${i}`} className="grid gap-1 py-2.5 sm:grid-cols-[220px_1fr] sm:gap-4">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm break-words whitespace-pre-wrap text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="rounded-[24px] border border-azure-50 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("sections.documents.title")}</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pdf.documentsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-azure-50">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <FileText aria-hidden="true" className="size-4 shrink-0 text-electric" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{sanitizeDisplayName(u.original_name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`docTypes.${u.doc_type}` as never)} · {formatBytes(u.size_bytes, locale)}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/intake/uploads/${u.id}`}>
                    <Download aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">{t("detail.download")}</span>
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[24px] border border-azure-50 bg-white p-5 sm:p-6">
        <h2 className="mb-2 text-lg font-semibold text-ink">{t("sign.signaturesTitle")}</h2>
        <p className="mb-4 text-sm leading-relaxed text-graphite">{t("sign.declaration")}</p>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t("detail.confirmations")}</h3>
        <ul className="mb-5 space-y-1.5 text-sm">
          {(
            [
              ["sign.consent", true],
              ["sign.pub135", submission.pub135_acknowledged],
              ["sign.agreement", submission.agreement_accepted],
            ] as const
          ).map(([key, ok]) => (
            <li key={key} className="flex items-start gap-2">
              {ok ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-6 sm:grid-cols-2">
          {signatures.map((s) => (
            <figure key={s.who} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL behind an authorized redirect */}
              <img
                src={`/api/intake/submissions/${submission.id}/signature${s.who === "spouse" ? "?who=spouse" : ""}`}
                alt={t("detail.signatureOf", { name: s.name })}
                className="aspect-[10/3] w-full rounded-2xl border border-azure-50 bg-white object-contain"
              />
              <figcaption className="text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {s.who === "spouse" ? t("pdf.spouseSignedBy") : t("pdf.signedBy")} · {t(`signatureMethods.${s.method}` as never)}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        {submission.face_photo_path ? (
          <figure className="mt-6 space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL behind an authorized redirect */}
            <img
              src={`/api/intake/submissions/${submission.id}/photo`}
              alt={t("detail.photoOf", { name: submission.signer_name })}
              className="aspect-[3/4] w-40 rounded-2xl border border-azure-50 bg-mist object-cover"
            />
            <figcaption className="text-sm text-muted-foreground">{t("face.title")}</figcaption>
          </figure>
        ) : null}
        <p className="mt-4 text-xs text-muted-foreground">
          {t("pdf.signedAt")}: <time dateTime={submission.signed_at}>{format.dateTime(new Date(submission.signed_at), "long")}</time>
          {full && submission.signer_ip ? ` · ${t("pdf.signerIp")}: ${String(submission.signer_ip)}` : ""}
        </p>
      </section>
    </div>
  );
}
