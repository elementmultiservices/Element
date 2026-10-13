import type { Metadata } from "next";
import { FolderTree, Plus } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination, TableShell, Th } from "@/components/tables/table-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { locales, toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { effectiveStatus, listAdminPosts, listPostCategories, type PostStatus } from "@/lib/blog/queries";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { POST_STATUSES } from "@/lib/validation/blog";
import { DeletePostButton } from "./post-actions";

const PAGE_SIZE = 25;
const paramsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(POST_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/blog", page: "adminBlog", noIndex: true });
}

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "text-muted-foreground",
  scheduled: "border-info/30 bg-info-bg text-info",
  published: "border-success/30 bg-success-bg text-success",
};

export default async function AdminBlogPage({ params, searchParams }: PageProps<"/[locale]/admin/blog">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const filters = paramsSchema.parse(await searchParams);
  const supabase = await createClient();
  const [list, categories] = await Promise.all([listAdminPosts(supabase, filters, PAGE_SIZE), listPostCategories(supabase)]);
  const categoryName = new Map(categories.map((c) => [c.id, locale === "es" ? c.nameEs : c.nameEn]));
  const basePath = "/admin/blog";

  return (
    <>
      <PageHeader
        title={t("Panel.admin.blog")}
        description={t("Admin.blog.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.blog") }]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/blog/categories">
                <FolderTree aria-hidden="true" />
                {t("Admin.blog.categoriesLink")}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/blog/new">
                <Plus aria-hidden="true" />
                {t("Admin.blog.newPost")}
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" role="search" className="mb-4 rounded-[24px] border border-azure-50 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="blog-q">{t("Admin.blog.searchLabel")}</Label>
            <Input id="blog-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-status">{t("Admin.blog.statusFilter")}</Label>
            <NativeSelect id="blog-status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">{t("Admin.common.all")}</option>
              {POST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`Admin.blog.statuses.${s}`)}
                </option>
              ))}
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

      {list.total === 0 ? (
        <p className="rounded-[24px] border border-dashed border-azure-100 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.blog.empty")}</p>
      ) : (
        <TableShell
          caption={t("Admin.blog.table.caption")}
          footer={<Pagination params={filters} basePath={basePath} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={PAGE_SIZE} />}
        >
          <thead className="border-b bg-surface">
            <tr>
              <Th>{t("Admin.blog.table.title")}</Th>
              <Th>{t("Admin.blog.table.status")}</Th>
              <Th>{t("Admin.blog.table.languages")}</Th>
              <Th className="hidden lg:table-cell">{t("Admin.blog.table.category")}</Th>
              <Th>{t("Admin.blog.table.date")}</Th>
              <Th className="hidden xl:table-cell">{t("Admin.blog.table.updated")}</Th>
              <Th className="text-right">
                <span className="sr-only">{t("Admin.common.actions")}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-azure-50">
            {list.rows.map((p) => {
              const title = p.translations[locale]?.title ?? p.translations.en?.title ?? p.translations.es?.title ?? t("Admin.blog.untitled");
              const status = effectiveStatus(p);
              return (
                <tr key={p.id} className="transition-colors hover:bg-azure-25/60">
                  <td className="max-w-72 px-4 py-3.5">
                    <Link href={`/admin/blog/${p.id}`} className="block truncate font-medium text-ink hover:text-electric" title={title}>
                      {title}
                    </Link>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-azure-25 px-2 py-0.5 text-[11px] font-medium text-navy">{t(`Admin.blog.editor.kinds.${p.kind}`)}</span>
                      {p.isFeatured ? (
                        <span className="rounded-full bg-electric px-2 py-0.5 text-[11px] font-semibold text-white">{t("Admin.blog.featuredBadge")}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status])}>
                      {t(`Admin.blog.statuses.${status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {locales.map((l) => {
                        const has = !!p.translations[l];
                        return (
                          <span
                            key={l}
                            title={has ? t("Admin.blog.complete") : t("Admin.blog.missing")}
                            className={cn(
                              "rounded-sm border px-1.5 py-0.5 text-xs font-medium uppercase",
                              has ? "border-success/30 bg-success-bg text-success" : "border-warning/30 bg-warning-bg text-warning line-through",
                            )}
                          >
                            {l}
                            <span className="sr-only">: {has ? t("Admin.blog.complete") : t("Admin.blog.missing")}</span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">
                    {p.categoryId ? (categoryName.get(p.categoryId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                    {p.publishedAt ? <time dateTime={p.publishedAt}>{format.dateTime(new Date(p.publishedAt), "long")}</time> : "—"}
                  </td>
                  <td className="hidden px-4 py-3.5 whitespace-nowrap text-muted-foreground xl:table-cell">
                    <time dateTime={p.updatedAt}>{format.dateTime(new Date(p.updatedAt), "short")}</time>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/blog/${p.id}`}>{t("Admin.blog.edit")}</Link>
                      </Button>
                      <DeletePostButton id={p.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
