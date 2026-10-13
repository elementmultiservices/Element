import type { Metadata } from "next";
import { Mail } from "lucide-react";
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
import { userDisplayName, userLabels } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MessageStatusAction } from "./message-actions";

const PAGE_SIZE = 20;
const paramsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["pending", "handled", "all"]).default("pending").catch("pending"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/messages">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/messages", page: "adminMessages", noIndex: true });
}

export default async function AdminMessagesPage({ params, searchParams }: PageProps<"/[locale]/admin/messages">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const filters = paramsSchema.parse(await searchParams);

  const supabase = await createClient();
  let query = supabase
    .from("contact_messages")
    .select("id, name, email, subject, message, locale, is_handled, handled_by, handled_at, created_at", { count: "exact" });
  if (filters.status !== "all") query = query.eq("is_handled", filters.status === "handled");
  if (filters.q) {
    // PostgREST `or` syntax: drop its reserved characters, escape LIKE
    // wildcards, then quote the value (backslashes doubled inside quotes).
    const like = filters.q.replace(/[",()\\]/g, " ").replace(/[%_]/g, (c) => `\\${c}`);
    const p = `"%${like.replace(/\\/g, "\\\\")}%"`;
    query = query.or(`name.ilike.${p},email.ilike.${p},subject.ilike.${p}`);
  }
  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = data ?? [];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const labels = await userLabels(supabase, rows.map((r) => r.handled_by));
  const basePath = "/admin/messages";

  return (
    <>
      <PageHeader
        title={t("Panel.admin.messages")}
        description={t("Admin.messages.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.messages") }]}
      />

      <form method="get" role="search" className="mb-4 rounded-[24px] border border-azure-50 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="msg-q">{t("Admin.messages.filters.search")}</Label>
            <Input id="msg-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} placeholder={t("Admin.messages.filters.searchPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg-status">{t("Admin.messages.filters.status")}</Label>
            <NativeSelect id="msg-status" name="status" defaultValue={filters.status}>
              <option value="pending">{t("Admin.messages.filters.pending")}</option>
              <option value="handled">{t("Admin.messages.filters.handled")}</option>
              <option value="all">{t("Admin.messages.filters.all")}</option>
            </NativeSelect>
          </div>
        </div>
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
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.messages.empty")}</p>
      ) : (
        <section aria-label={t("Admin.messages.table.caption")} className="rounded-[24px] border border-azure-50 bg-white">
          <ul className="divide-y">
            {rows.map((m) => (
              <li key={m.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{m.subject}</p>
                      <Badge
                        variant="outline"
                        className={cn("font-normal", m.is_handled ? "border-success/30 bg-success-bg text-success" : "border-warning/30 bg-warning-bg text-warning")}
                      >
                        {m.is_handled ? t("Admin.messages.handled") : t("Admin.messages.pending")}
                      </Badge>
                      <span className="rounded-full bg-azure-25 px-2 py-0.5 font-mono text-[11px] text-navy uppercase">{m.locale}</span>
                    </div>
                    <p className="mt-1 text-sm break-all text-muted-foreground">
                      {m.name} · {m.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={m.created_at}>{format.dateTime(new Date(m.created_at), "long")}</time>
                      {m.is_handled && m.handled_at
                        ? ` · ${t("Admin.messages.handledBy", {
                            name: userDisplayName(m.handled_by ? labels.get(m.handled_by) : undefined, t("Admin.common.unknownUser")),
                            date: format.dateTime(new Date(m.handled_at), "short"),
                          })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
                        <Mail aria-hidden="true" />
                        {t("Admin.messages.reply")}
                      </a>
                    </Button>
                    <MessageStatusAction id={m.id} handled={m.is_handled} />
                  </div>
                </div>
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-sm text-link hover:underline">{t("Admin.messages.showMessage")}</summary>
                  <p className="mt-2 rounded-2xl border border-azure-50 bg-mist p-3 text-sm whitespace-pre-wrap break-words">{m.message}</p>
                </details>
              </li>
            ))}
          </ul>
          <Pagination params={filters} basePath={basePath} page={Math.min(filters.page, pageCount)} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} />
        </section>
      )}
    </>
  );
}
