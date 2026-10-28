import type { Metadata } from "next";
import { Download, Eye } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/tables/table-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { userLabels } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { intakeReference } from "@/lib/intake/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const paramsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["new", "reviewed", "all"]).default("all").catch("all"),
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  assigned: z.enum(["all", "unassigned", "assigned"]).default("all").catch("all"),
  owner: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/intake">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/intake", page: "adminIntake", noIndex: true });
}

export default async function AdminIntakePage({ params, searchParams }: PageProps<"/[locale]/admin/intake">) {
  const { locale: rawLocale } = await params;
  setRequestLocale(toLocale(rawLocale));
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const filters = paramsSchema.parse(await searchParams);

  const supabase = await createClient();
  let query = supabase
    .from("intake_submissions")
    .select("id, owner_id, contact_email, tax_year, filing_status, taxpayer_name, status, signed_at, locale, intake_uploads(count)", { count: "exact" });
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.year) query = query.eq("tax_year", filters.year);
  if (filters.assigned === "unassigned") query = query.is("owner_id", null);
  if (filters.assigned === "assigned") query = query.not("owner_id", "is", null);
  if (filters.owner) query = query.eq("owner_id", filters.owner);
  if (filters.q) {
    // Name or email. Wildcards and characters with a meaning in or() filters are dropped.
    const term = filters.q.replace(/[%_*\\,()"]/g, " ").trim();
    if (term) query = query.or(`taxpayer_name.ilike.%${term}%,contact_email.ilike.%${term}%`);
  }
  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("signed_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = data ?? [];
  const total = count ?? 0;
  const labels = await userLabels(supabase, [...rows.map((r) => r.owner_id), filters.owner]);
  const ownerLabel = filters.owner ? labels.get(filters.owner) : undefined;
  const labelOf = (id: string) => {
    const l = labels.get(id);
    return l ? l.fullName.trim() || l.email : t("Admin.intake.account");
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const basePath = "/admin/intake";
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <>
      <PageHeader
        title={t("Panel.admin.intake")}
        description={t("Admin.intake.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.intake") }]}
      />

      <form method="get" role="search" className="mb-4 rounded-[24px] border border-azure-50 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="intake-q">{t("Admin.intake.filters.search")}</Label>
            <Input id="intake-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} placeholder={t("Admin.intake.filters.searchPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-year">{t("Intake.fields.taxYear")}</Label>
            <NativeSelect id="intake-year" name="year" defaultValue={filters.year ? String(filters.year) : ""}>
              <option value="">{t("Admin.intake.filters.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-status">{t("Admin.intake.filters.status")}</Label>
            <NativeSelect id="intake-status" name="status" defaultValue={filters.status}>
              <option value="all">{t("Admin.intake.filters.all")}</option>
              <option value="new">{t("Intake.status.new")}</option>
              <option value="reviewed">{t("Intake.status.reviewed")}</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-assigned">{t("Admin.intake.filters.assignment")}</Label>
            <NativeSelect id="intake-assigned" name="assigned" defaultValue={filters.assigned}>
              <option value="all">{t("Admin.intake.filters.all")}</option>
              <option value="unassigned">{t("Admin.intake.unassigned")}</option>
              <option value="assigned">{t("Admin.intake.filters.assigned")}</option>
            </NativeSelect>
          </div>
        </div>
        {filters.owner ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <input type="hidden" name="owner" value={filters.owner} />
            {t("Admin.intake.filters.owner", { name: ownerLabel ? labelOf(filters.owner) : filters.owner })}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {t("Admin.common.apply")}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={basePath}>{t("Admin.common.clear")}</Link>
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.intake.empty")}</p>
      ) : (
        <section aria-label={t("Panel.admin.intake")} className="rounded-[24px] border border-azure-50 bg-white">
          <ul className="divide-y">
            {rows.map((r) => {
              const documents = r.intake_uploads?.[0]?.count ?? 0;
              return (
                <li key={r.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/intake/${r.id}`} className="font-medium break-words hover:text-electric hover:underline">
                        {r.taxpayer_name}
                      </Link>
                      <Badge
                        variant="outline"
                        className={cn("font-normal", r.status === "reviewed" ? "border-success/30 bg-success-bg text-success" : "border-warning/30 bg-warning-bg text-warning")}
                      >
                        {t(`Intake.status.${r.status}` as "Intake.status.new")}
                      </Badge>
                      {r.owner_id ? null : (
                        <Badge variant="outline" className="border-warning/30 bg-warning-bg font-normal text-warning">
                          {t("Admin.intake.unassigned")}
                        </Badge>
                      )}
                      <span className="rounded-full bg-azure-25 px-2 py-0.5 font-mono text-[11px] text-navy uppercase">{r.locale}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("Intake.list.item", { year: r.tax_year })} · {t(`Intake.filingStatus.${r.filing_status}` as "Intake.filingStatus.single")} ·{" "}
                      {t("Admin.intake.documents", { count: documents })}
                    </p>
                    {r.contact_email ? <p className="text-sm break-all text-muted-foreground">{r.contact_email}</p> : null}
                    {r.owner_id ? (
                      <p className="text-sm text-muted-foreground">
                        {t("Admin.intake.assign.assignedTo")}:{" "}
                        <Link href={`/admin/users/${r.owner_id}`} className="text-link hover:underline">
                          {labelOf(r.owner_id)}
                        </Link>
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={r.signed_at}>{format.dateTime(new Date(r.signed_at), "long")}</time> · {t("Intake.list.reference", { reference: intakeReference(r.id) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/intake/${r.id}`}>
                        <Eye aria-hidden="true" />
                        {t("Admin.intake.view")}
                      </Link>
                    </Button>
                    {(["en", "es"] as const).map((lang) => (
                      <Button key={lang} asChild variant="outline" size="sm">
                        <a href={`/api/intake/submissions/${r.id}/pdf?lang=${lang}`} download>
                          <Download aria-hidden="true" />
                          {t(`Intake.detail.pdf.${lang}`)}
                        </a>
                      </Button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination params={filters} basePath={basePath} page={Math.min(filters.page, pageCount)} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} />
        </section>
      )}
    </>
  );
}
