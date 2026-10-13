import type { Metadata } from "next";
import { ArrowRight, FileText, HardDrive, Upload, Users } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { stagger } from "@/components/marketing/motion";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getOverview, listAdminFiles, searchAudit, userDisplayName, userLabels } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { sanitizeDisplayName } from "@/lib/files/rules";
import { formatBytes } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { describeUserAgent } from "@/lib/user-agent";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin", page: "admin", noIndex: true });
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  featured = false,
  index,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail?: string;
  featured?: boolean;
  index: number;
}) {
  return (
    <div
      style={stagger(index)}
      className={cn(
        "reveal relative flex flex-col gap-4 overflow-hidden rounded-[24px] p-6 transition-transform duration-300 hover:-translate-y-0.5",
        featured ? "bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] text-white" : "border border-azure-50 bg-white",
      )}
    >
      {featured ? <span aria-hidden="true" className="absolute -right-12 -bottom-16 size-44 rounded-full bg-sky/25 blur-3xl" /> : null}
      <div className="relative flex items-center justify-between gap-2">
        <p className={cn("text-sm font-medium", featured ? "text-azure-100" : "text-graphite")}>{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-full", featured ? "bg-white/10" : "bg-azure-25")}>
          <Icon aria-hidden="true" className={cn("size-4", featured ? "text-azure-300" : "text-electric")} />
        </span>
      </div>
      <p className={cn("relative text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums", featured ? "text-white" : "text-ink")}>{value}</p>
      {detail ? <p className={cn("relative text-xs", featured ? "text-azure-100" : "text-graphite")}>{detail}</p> : null}
    </div>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="reveal overflow-hidden rounded-[24px] border border-azure-50 bg-white">
      <div className="flex items-center justify-between border-b border-azure-50 px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-electric">
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function AdminOverviewPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const session = await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();

  const [overview, uploads, signIns] = await Promise.all([
    getOverview(supabase),
    listAdminFiles(supabase, { sort: "created_at", dir: "desc", page: 1 }, { limit: 8 }),
    searchAudit(supabase, { page: 1 }, { limit: 8, exactAction: "auth.sign_in.success" }),
  ]);
  const labels = await userLabels(supabase, uploads.rows.map((f) => f.ownerId));
  const number = (n: number) => format.number(n);

  return (
    <>
      <PageHeader
        title={t("Panel.admin.overview")}
        description={session.fullName ? t("Panel.welcome", { name: session.fullName }) : t("Admin.overview.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.overview") }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          featured
          icon={Users}
          label={t("Admin.overview.users")}
          value={number(overview.usersTotal)}
          detail={t("Admin.overview.usersDetail", {
            active: number(overview.usersActive),
            inactive: number(overview.usersInactive),
            pending: number(overview.usersPending),
          })}
        />
        <StatCard
          index={1}
          icon={FileText}
          label={t("Admin.overview.files")}
          value={number(overview.filesActive)}
          detail={t("Admin.overview.filesDetail", { trashed: number(overview.filesTrashed) })}
        />
        <StatCard
          index={2}
          icon={HardDrive}
          label={t("Admin.overview.storage")}
          value={formatBytes(overview.storageUsedBytes, locale)}
          detail={t("Admin.overview.storageDetail", { trashed: formatBytes(overview.storageTrashedBytes, locale) })}
        />
        <StatCard index={3} icon={Upload} label={t("Admin.overview.uploads7d")} value={number(overview.uploadsLast7d)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title={t("Admin.overview.recentUploads")} href="/admin/files" linkLabel={t("Admin.overview.viewAll")}>
          {uploads.rows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-graphite">{t("Admin.overview.noUploads")}</p>
          ) : (
            <ul className="divide-y divide-azure-50">
              {uploads.rows.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm transition-colors hover:bg-azure-25/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{sanitizeDisplayName(f.originalName)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {userDisplayName(labels.get(f.ownerId), t("Admin.common.unknownUser"))} · {formatBytes(f.sizeBytes, locale)}
                    </p>
                  </div>
                  <time dateTime={f.createdAt} className="shrink-0 text-xs text-muted-foreground">
                    {format.dateTime(new Date(f.createdAt), "short")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t("Admin.overview.recentSignIns")}
          href="/admin/audit?action=auth"
          linkLabel={t("Admin.overview.viewAll")}
        >
          {signIns.rows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-graphite">{t("Admin.overview.noSignIns")}</p>
          ) : (
            <ul className="divide-y divide-azure-50">
              {signIns.rows.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm transition-colors hover:bg-azure-25/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{a.actorName?.trim() || a.actorEmail || t("Admin.common.unknownUser")}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[a.ip, describeUserAgent(a.userAgent)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted-foreground">
                    {format.dateTime(new Date(a.createdAt), "long")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
