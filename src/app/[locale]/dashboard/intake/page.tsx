import type { Metadata } from "next";
import { ClipboardList, Plus } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { intakeReference } from "@/lib/intake/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/intake">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard/intake", page: "intake", noIndex: true });
}

export default async function DashboardIntakePage({ params }: PageProps<"/[locale]/dashboard/intake">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const { data } = await supabase
    .from("intake_submissions")
    .select("id, tax_year, filing_status, taxpayer_name, status, signed_at")
    .eq("owner_id", session.userId)
    .order("signed_at", { ascending: false })
    .limit(50);
  const rows = data ?? [];

  const newButton = (
    <Button asChild>
      <Link href="/dashboard/intake/new">
        <Plus aria-hidden="true" />
        {t("Intake.list.new")}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t("Panel.user.intake")}
        description={t("Intake.list.description")}
        breadcrumbs={[{ label: t("Panel.dashboardTitle"), href: "/dashboard" }, { label: t("Panel.user.intake") }]}
        actions={rows.length > 0 ? newButton : null}
      />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("Intake.list.emptyTitle")} body={t("Intake.list.emptyBody")} action={newButton} />
      ) : (
        <ul className="divide-y rounded-[24px] border border-azure-50 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/intake/${r.id}`} className="flex flex-col gap-1 p-4 hover:bg-mist sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{t("Intake.list.item", { year: r.tax_year })}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`Intake.filingStatus.${r.filing_status}` as "Intake.filingStatus.single")} · {t("Intake.list.reference", { reference: intakeReference(r.id) })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <time dateTime={r.signed_at}>{format.dateTime(new Date(r.signed_at), "long")}</time>
                  <Badge variant="outline" className="font-normal">
                    {t(`Intake.status.${r.status}` as "Intake.status.new")}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
