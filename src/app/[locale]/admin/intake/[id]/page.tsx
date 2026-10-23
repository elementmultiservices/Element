import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FormAlert } from "@/components/forms/form-alert";
import { IntakeDetail, IntakePdfButtons } from "@/components/intake/intake-detail";
import { PageHeader } from "@/components/layout/page-header";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getUser, userDisplayName, userLabels } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getIntakeSubmission, intakeReference } from "@/lib/intake/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { IntakeStatusAction } from "./intake-actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/intake/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/admin/intake/${id}`, page: "adminIntake", noIndex: true });
}

export default async function AdminIntakeDetailPage({ params }: PageProps<"/[locale]/admin/intake/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(toLocale(locale));
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const found = await getIntakeSubmission(supabase, id);
  if (!found) notFound();
  const { submission, uploads } = found;
  const [labels, account] = await Promise.all([userLabels(supabase, [submission.owner_id, submission.reviewed_by]), getUser(supabase, submission.owner_id)]);
  const formLast4 = submission.data.taxpayer.ssn.slice(-4);
  const accountLast4 = account?.idLast4 ?? null;
  const owner = labels.get(submission.owner_id);
  const reference = intakeReference(submission.id);

  return (
    <>
      <PageHeader
        title={submission.taxpayer_name}
        description={`${t("Intake.list.item", { year: submission.tax_year })} · ${t("Intake.list.reference", { reference })}`}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.intake"), href: "/admin/intake" },
          { label: reference },
        ]}
        actions={<IntakePdfButtons id={submission.id} />}
      />
      <div className="max-w-4xl space-y-5">
        <section className="flex flex-col gap-3 rounded-[24px] border border-azure-50 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">{t("Admin.intake.account")}: </span>
              <Link href={`/admin/users/${submission.owner_id}`} className="font-medium text-electric hover:underline">
                {userDisplayName(owner, t("Admin.common.unknownUser"))}
              </Link>
            </p>
            <p>
              <span className="text-muted-foreground">{t("Admin.users.idLast4.label")}: </span>
              <span className="font-mono font-medium">{accountLast4 ? `•••-••-${accountLast4}` : t("Admin.users.idLast4.none")}</span>
            </p>
            <p className="text-muted-foreground">
              {submission.status === "reviewed" && submission.reviewed_at
                ? t("Admin.intake.reviewedBy", {
                    name: userDisplayName(submission.reviewed_by ? labels.get(submission.reviewed_by) : undefined, t("Admin.common.unknownUser")),
                    date: format.dateTime(new Date(submission.reviewed_at), "short"),
                  })
                : t("Intake.status.new")}
            </p>
          </div>
          <IntakeStatusAction id={submission.id} reviewed={submission.status === "reviewed"} />
        </section>
        {accountLast4 && accountLast4 !== formLast4 ? (
          <FormAlert variant="error">
            {t("Admin.intake.idMismatch", { account: accountLast4, form: formLast4 })}{" "}
            <Link href={`/admin/users/${submission.owner_id}`} className="font-medium underline">
              {t("Admin.intake.idMismatchAction")}
            </Link>
          </FormAlert>
        ) : null}
        <IntakeDetail submission={submission} uploads={uploads} full />
      </div>
    </>
  );
}
