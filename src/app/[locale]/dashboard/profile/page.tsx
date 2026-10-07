import type { Metadata } from "next";
import { ShieldCheck, ShieldOff } from "lucide-react";
import type { Messages } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { describeUserAgent } from "@/lib/user-agent";
import { LocaleForm, MfaControls, NameForm, PasswordForm } from "./profile-forms";

type EventKey = keyof Messages["Profile"]["activity"]["events"];
const EVENT_KEYS = new Set<string>([
  "sign_in_success",
  "sign_in_failure",
  "sign_in_locked",
  "sign_out",
  "session_ended",
  "password_reset_requested",
  "password_updated",
  "link_verified",
  "mfa_enrolled",
  "mfa_verified",
  "mfa_failed",
  "mfa_disabled",
] satisfies EventKey[]);

function eventKey(action: string): EventKey {
  const key = action.replace(/^auth\./, "").replace(/\./g, "_");
  return EVENT_KEYS.has(key) ? (key as EventKey) : "other";
}

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/profile">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard/profile", page: "profile", noIndex: true });
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card p-6">
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/dashboard/profile">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const { data: activity } = await supabase.rpc("my_auth_activity", { p_limit: 20 });

  return (
    <>
      <PageHeader
        title={t("Panel.user.profile")}
        description={t("Profile.description")}
        breadcrumbs={[{ label: t("Panel.dashboardTitle"), href: "/dashboard" }, { label: t("Panel.user.profile") }]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section id="profile-details" title={t("Profile.details.heading")}>
          <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("Profile.details.email")}</dt>
              <dd className="font-medium break-all">{session.email}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{t("Profile.details.emailHint")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Profile.details.role")}</dt>
              <dd className="font-medium">{t(`Panel.roles.${session.role}`)}</dd>
            </div>
          </dl>
          <NameForm fullName={session.fullName} />
        </Section>

        <Section id="profile-language" title={t("Profile.language.heading")} description={t("Profile.language.description")}>
          <LocaleForm current={session.locale} />
        </Section>

        <Section id="profile-password" title={t("Profile.password.heading")} description={t("Profile.password.description")}>
          <PasswordForm />
        </Section>

        <Section id="profile-mfa" title={t("Profile.mfa.heading")}>
          <div className="mb-4 flex items-center gap-2">
            {session.hasVerifiedMfa ? (
              <Badge variant="outline" className="gap-1 border-success/30 bg-success-bg text-success">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {t("Profile.mfa.enabled")}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <ShieldOff aria-hidden="true" className="size-3.5" />
                {t("Profile.mfa.disabled")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {session.hasVerifiedMfa ? t("Profile.mfa.enabledBody") : t("Profile.mfa.disabledBody")}
          </p>
          <div className="mt-4">
            <MfaControls enabled={session.hasVerifiedMfa} isAdmin={session.role === "admin"} />
          </div>
        </Section>
      </div>

      <div className="mt-6">
        <Section id="profile-activity" title={t("Profile.activity.heading")} description={t("Profile.activity.description")}>
          {activity && activity.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b bg-surface">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{t("Profile.activity.date")}</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{t("Profile.activity.event")}</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{t("Profile.activity.ip")}</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{t("Profile.activity.device")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activity.map((row) => {
                    const key = eventKey(row.action);
                    const failed = key === "sign_in_failure" || key === "sign_in_locked" || key === "mfa_failed";
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          <time dateTime={row.created_at}>{format.dateTime(new Date(row.created_at), "long")}</time>
                        </td>
                        <td className={failed ? "px-3 py-2 font-medium text-destructive" : "px-3 py-2"}>
                          {t(`Profile.activity.events.${key}`)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{String(row.ip ?? t("Profile.activity.unknown"))}</td>
                        <td className="px-3 py-2 text-muted-foreground">{describeUserAgent(row.user_agent) ?? t("Profile.activity.unknown")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("Profile.activity.empty")}</p>
          )}
        </Section>
      </div>
    </>
  );
}
