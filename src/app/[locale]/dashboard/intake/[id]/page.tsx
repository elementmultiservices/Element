import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormAlert } from "@/components/forms/form-alert";
import { IntakeDetail, IntakePdfButtons } from "@/components/intake/intake-detail";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { getIntakeSubmission, intakeReference } from "@/lib/intake/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/intake/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/dashboard/intake/${id}`, page: "intake", noIndex: true });
}

export default async function IntakeSubmissionPage({ params, searchParams }: PageProps<"/[locale]/dashboard/intake/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(toLocale(locale));
  await requireUser();
  const t = await getTranslations();
  const { submitted } = await searchParams;

  const found = await getIntakeSubmission(await createClient(), id);
  if (!found) notFound();
  const { submission, uploads } = found;
  const reference = intakeReference(submission.id);

  return (
    <>
      <PageHeader
        title={t("Intake.list.item", { year: submission.tax_year })}
        description={t("Intake.list.reference", { reference })}
        breadcrumbs={[
          { label: t("Panel.dashboardTitle"), href: "/dashboard" },
          { label: t("Panel.user.intake"), href: "/dashboard/intake" },
          { label: reference },
        ]}
        actions={<IntakePdfButtons id={submission.id} />}
      />
      <div className="max-w-4xl space-y-5">
        {submitted === "1" ? <FormAlert variant="success">{t("Intake.detail.submitted", { reference })}</FormAlert> : null}
        <IntakeDetail submission={submission} uploads={uploads} full={false} />
      </div>
    </>
  );
}
