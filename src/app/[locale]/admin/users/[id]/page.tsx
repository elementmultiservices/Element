import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { QuotaMeter } from "@/components/files/quota-meter";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getUser, searchAudit } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { AccountActions, QuotaForm } from "./user-controls";

const MB = 1024 * 1024;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/users/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  return pageMetadata({ locale: toLocale(locale), path: `/admin/users/${id}`, page: "adminUser", noIndex: true });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminUserPage({ params }: PageProps<"/[locale]/admin/users/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const session = await requireAdmin();
  if (!z.uuid().safeParse(id).success) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const user = await getUser(supabase, id);
  if (!user) notFound();
  const activity = await searchAudit(supabase, { subject: id, page: 1 }, { limit: 10 });
  const isSelf = user.id === session.userId;
  const name = user.fullName.trim() || user.email;

  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), "long") : t("Admin.common.never"));

  return (
    <>
      <PageHeader
        title={name}
        description={user.email}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.users"), href: "/admin/users" },
          { label: name },
        ]}
        actions={
          user.role === "user" ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/admin/files?owner=${user.id}`}>
                  <FileText aria-hidden="true" />
                  {t("Admin.users.detail.viewFiles")}
                </Link>
              </Button>
              {user.isActive ? (
                <Button asChild>
                  <Link href={`/admin/files/upload?owner=${user.id}`}>
                    <Upload aria-hidden="true" />
                    {t("Admin.users.detail.uploadForUser")}
                  </Link>
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <RoleBadge role={user.role} />
        <UserStatusBadge isActive={user.isActive} invitationPending={user.invitationPending} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("Admin.users.detail.summary")}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("Admin.users.detail.created")}</dt>
              <dd className="font-medium">{date(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Admin.users.detail.lastSignIn")}</dt>
              <dd className="font-medium">{date(user.lastSignInAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Admin.users.detail.language")}</dt>
              <dd className="font-medium">{t(`Common.languages.${user.locale}`)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Admin.users.detail.files")}</dt>
              <dd className="font-medium tabular-nums">{format.number(user.fileCount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Admin.users.detail.mfa")}</dt>
              <dd className="font-medium">{user.hasMfa ? t("Admin.users.detail.mfaOn") : t("Admin.users.detail.mfaOff")}</dd>
            </div>
          </dl>
        </Section>

        <Section title={t("Admin.users.detail.storageHeading")}>
          <div className="space-y-5">
            <QuotaMeter bare usage={{ usedBytes: user.usedBytes, quotaBytes: user.quotaBytes }} />
            <QuotaForm userId={user.id} quotaMb={Math.round(user.quotaBytes / MB)} />
          </div>
        </Section>
      </div>

      <div className="mt-6">
        <Section title={t("Admin.users.detail.actionsHeading")}>
          {isSelf ? (
            <FormAlert variant="info">
              {t("Admin.users.detail.self")}{" "}
              <Link href="/admin/profile" className="font-medium underline">
                {t("Panel.admin.profile")}
              </Link>
            </FormAlert>
          ) : (
            <AccountActions userId={user.id} isActive={user.isActive} invitationPending={user.invitationPending} role={user.role} />
          )}
        </Section>
      </div>

      <div className="mt-6">
        <Section title={t("Admin.users.detail.activity")}>
          {activity.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Admin.users.detail.activityEmpty")}</p>
          ) : (
            <>
              <ul className="divide-y rounded-md border text-sm">
                {activity.rows.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <code className="text-xs font-semibold text-primary">{a.action}</code>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.actorEmail ?? t("Admin.common.system")}
                        {a.targetLabel ? ` → ${a.targetLabel}` : ""}
                      </p>
                    </div>
                    <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted-foreground">
                      {format.dateTime(new Date(a.createdAt), "long")}
                    </time>
                  </li>
                ))}
              </ul>
              <Link href={`/admin/audit?subject=${user.id}`} className="mt-3 inline-block text-sm text-link hover:underline">
                {t("Admin.users.detail.viewAudit")}
              </Link>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
