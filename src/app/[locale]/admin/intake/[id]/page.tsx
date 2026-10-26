import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FormAlert } from "@/components/forms/form-alert";
import { IntakeDetail, IntakePdfButtons } from "@/components/intake/intake-detail";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getUser, userDisplayName, userLabels, userOptions, type AdminUserRow } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getIntakeSubmission, intakeReference } from "@/lib/intake/queries";
import { pageMetadata } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AssignPicker, AssignToMatchAction, IntakeStatusAction, InviteAndAssignAction, UnassignAction } from "./intake-actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/intake/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/admin/intake/${id}`, page: "adminIntake", noIndex: true });
}

const maskedLast4 = (last4: string) => `•••-••-${last4}`;

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
  const contactEmail = (submission.contact_email ?? submission.data.taxpayer.email).toLowerCase();
  const formLast4 = submission.data.taxpayer.ssn.slice(-4);

  // The account that uses the email typed in the form, if any (it may not be the owner).
  const { data: matchId } = await createAdminClient().rpc("auth_user_id_by_email", { p_email: contactEmail });
  const [labels, account, match, options] = await Promise.all([
    userLabels(supabase, [submission.owner_id, submission.reviewed_by, submission.assigned_by]),
    submission.owner_id ? getUser(supabase, submission.owner_id) : Promise.resolve(null),
    matchId && matchId !== submission.owner_id ? getUser(supabase, matchId) : Promise.resolve(null),
    userOptions(supabase),
  ]);
  const owners = options
    .filter((o) => o.role === "user" && o.isActive)
    .map((o) => ({ id: o.id, label: o.fullName ? `${o.fullName} · ${o.email}` : o.email }));
  const accountLast4 = account?.idLast4 ?? null;
  const reference = intakeReference(submission.id);
  const assignable = (u: AdminUserRow) => u.role === "user" && u.isActive;

  const last4Note = (u: AdminUserRow) =>
    u.idLast4 ? (
      <span className={u.idLast4 === formLast4 ? "text-success" : "text-destructive"}>
        {maskedLast4(u.idLast4)} · {t(u.idLast4 === formLast4 ? "Admin.intake.assign.last4Match" : "Admin.intake.assign.last4Differs")}
      </span>
    ) : (
      <span className="text-muted-foreground">{t("Admin.users.idLast4.none")}</span>
    );

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
        {/* Account: who the form belongs to, and how to assign it. */}
        <section aria-labelledby="intake-account" className="space-y-4 rounded-[24px] border border-azure-50 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="intake-account" className="font-semibold text-ink">
              {t("Admin.intake.account")}
            </h2>
            {submission.owner_id ? null : (
              <Badge variant="outline" className="border-warning/30 bg-warning-bg font-normal text-warning">
                {t("Admin.intake.unassigned")}
              </Badge>
            )}
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">{t("Admin.intake.assign.formEmail")}: </span>
            <span className="font-medium break-all">{contactEmail}</span>
            <span className="text-muted-foreground"> · {t("Admin.users.idLast4.label")}: </span>
            <span className="font-mono font-medium">{maskedLast4(formLast4)}</span>
          </p>

          {submission.owner_id ? (
            <div className="space-y-1 rounded-2xl bg-mist p-4 text-sm">
              <p>
                <span className="text-muted-foreground">{t("Admin.intake.assign.assignedTo")}: </span>
                <Link href={`/admin/users/${submission.owner_id}`} className="font-medium text-electric hover:underline">
                  {userDisplayName(labels.get(submission.owner_id), t("Admin.common.unknownUser"))}
                </Link>
                {account ? <span className="break-all text-muted-foreground"> · {account.email}</span> : null}
              </p>
              {account ? <p>{last4Note(account)}</p> : null}
              {account && account.email.toLowerCase() !== contactEmail ? <p className="text-warning">{t("Admin.intake.assign.emailDiffers")}</p> : null}
              {submission.assigned_at ? (
                <p className="text-muted-foreground">
                  {t("Admin.intake.assign.assignedBy", {
                    name: userDisplayName(submission.assigned_by ? labels.get(submission.assigned_by) : undefined, t("Admin.common.unknownUser")),
                    date: format.dateTime(new Date(submission.assigned_at), "short"),
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <FormAlert variant="info">{t("Admin.intake.assign.publicNote")}</FormAlert>
          )}

          {/* The registered account that uses the form's email (when it is not the owner already). */}
          {match ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-azure-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-ink">{t("Admin.intake.assign.matchFound")}</p>
                <p>
                  <Link href={`/admin/users/${match.id}`} className="font-medium text-electric hover:underline">
                    {userDisplayName(match, t("Admin.common.unknownUser"))}
                  </Link>
                  <span className="break-all text-muted-foreground"> · {match.email}</span>
                  {match.invitationPending ? <span className="text-muted-foreground"> · {t("Admin.intake.assign.invitationPending")}</span> : null}
                </p>
                <p>{last4Note(match)}</p>
                {assignable(match) ? null : (
                  <p className="text-warning">{t(match.role === "admin" ? "Admin.intake.assign.matchIsStaff" : "Admin.intake.assign.matchInactive")}</p>
                )}
              </div>
              {assignable(match) ? (
                <div className="shrink-0">
                  <AssignToMatchAction id={submission.id} userId={match.id} name={userDisplayName(match, match.email)} />
                </div>
              ) : null}
            </div>
          ) : !matchId && !submission.owner_id ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-azure-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0">{t("Admin.intake.assign.noMatch", { email: contactEmail })}</p>
              <div className="shrink-0">
                <InviteAndAssignAction id={submission.id} email={contactEmail} />
              </div>
            </div>
          ) : null}

          {owners.length > 0 ? <AssignPicker id={submission.id} owners={owners} currentOwnerId={submission.owner_id} /> : null}
          {submission.owner_id ? (
            <div className="flex justify-end">
              <UnassignAction id={submission.id} />
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-[24px] border border-azure-50 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {submission.status === "reviewed" && submission.reviewed_at
              ? t("Admin.intake.reviewedBy", {
                  name: userDisplayName(submission.reviewed_by ? labels.get(submission.reviewed_by) : undefined, t("Admin.common.unknownUser")),
                  date: format.dateTime(new Date(submission.reviewed_at), "short"),
                })
              : t("Intake.status.new")}
          </p>
          <IntakeStatusAction id={submission.id} reviewed={submission.status === "reviewed"} />
        </section>
        {submission.owner_id && accountLast4 && accountLast4 !== formLast4 ? (
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
