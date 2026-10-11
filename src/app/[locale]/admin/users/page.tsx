import type { Metadata } from "next";
import { Download, KeyRound, UserPlus } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RoleBadge, UploadAccessBadge, UserStatusBadge } from "@/components/admin/badges";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination, searchString, SortTh, TableShell, Th } from "@/components/tables/table-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ADMIN_PAGE_SIZE, listUsers } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatBytes } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { userListParamsSchema } from "@/lib/validation/admin";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/users">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/users", page: "adminUsers", noIndex: true });
}

export default async function AdminUsersPage({ params, searchParams }: PageProps<"/[locale]/admin/users">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const filters = userListParamsSchema.parse(await searchParams);
  const supabase = await createClient();
  const list = await listUsers(supabase, filters);
  const basePath = "/admin/users";

  return (
    <>
      <PageHeader
        title={t("Panel.admin.users")}
        description={t("Admin.users.description")}
        breadcrumbs={[{ label: t("Panel.adminTitle"), href: "/admin" }, { label: t("Panel.admin.users") }]}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/admin/export/users${searchString({ ...filters, locale })}`}>
                <Download aria-hidden="true" />
                {t("Admin.common.export")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/users/access">
                <KeyRound aria-hidden="true" />
                {t("Admin.users.upload.manageCta")}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/users/invite">
                <UserPlus aria-hidden="true" />
                {t("Admin.users.inviteCta")}
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" role="search" className="mb-4 rounded-lg border bg-card p-4">
        <input type="hidden" name="sort" value={filters.sort} />
        <input type="hidden" name="dir" value={filters.dir} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="users-q">{t("Admin.users.searchLabel")}</Label>
            <Input id="users-q" name="q" type="search" maxLength={100} defaultValue={filters.q ?? ""} placeholder={t("Admin.users.searchPlaceholder")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="users-status">{t("Admin.common.status")}</Label>
            <NativeSelect id="users-status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">{t("Admin.common.all")}</option>
              <option value="active">{t("Admin.statuses.active")}</option>
              <option value="inactive">{t("Admin.statuses.inactive")}</option>
              <option value="pending">{t("Admin.statuses.pending")}</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="users-role">{t("Admin.common.role")}</Label>
            <NativeSelect id="users-role" name="role" defaultValue={filters.role ?? ""}>
              <option value="">{t("Admin.common.all")}</option>
              <option value="user">{t("Panel.roles.user")}</option>
              <option value="admin">{t("Panel.roles.admin")}</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="users-upload">{t("Admin.users.upload.filter")}</Label>
            <NativeSelect id="users-upload" name="upload" defaultValue={filters.upload ?? ""}>
              <option value="">{t("Admin.common.all")}</option>
              <option value="yes">{t("Admin.users.upload.allowed")}</option>
              <option value="no">{t("Admin.users.upload.notAllowed")}</option>
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
        <p className="rounded-lg border border-dashed bg-surface px-6 py-10 text-center text-sm text-muted-foreground">{t("Admin.users.empty")}</p>
      ) : (
        <TableShell
          caption={t("Admin.users.table.caption")}
          footer={<Pagination params={filters} basePath={basePath} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={ADMIN_PAGE_SIZE} />}
        >
          <thead className="border-b bg-surface">
            <tr>
              <SortTh column="full_name" label={t("Admin.users.table.name")} params={filters} basePath={basePath} />
              <SortTh column="email" label={t("Admin.users.table.email")} params={filters} basePath={basePath} />
              <Th>{t("Admin.users.table.role")}</Th>
              <Th>{t("Admin.users.table.status")}</Th>
              <Th>{t("Admin.users.table.upload")}</Th>
              <SortTh column="used_bytes" label={t("Admin.users.table.storage")} params={filters} basePath={basePath} className="text-right" />
              <SortTh column="last_sign_in_at" label={t("Admin.users.table.lastSignIn")} params={filters} basePath={basePath} />
              <SortTh column="created_at" label={t("Admin.users.table.created")} params={filters} basePath={basePath} />
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.rows.map((u) => (
              <tr key={u.id} className="hover:bg-surface/60">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-link hover:underline">
                    {u.fullName.trim() || t("Admin.users.noName")}
                  </Link>
                </td>
                <td className="max-w-56 truncate px-3 py-2.5 text-muted-foreground" title={u.email}>
                  {u.email}
                </td>
                <td className="px-3 py-2.5">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-3 py-2.5">
                  <UserStatusBadge isActive={u.isActive} invitationPending={u.invitationPending} />
                </td>
                <td className="px-3 py-2.5">{u.role === "user" ? <UploadAccessBadge canUpload={u.canUpload} /> : null}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatBytes(u.usedBytes, locale)} / {formatBytes(u.quotaBytes, locale)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  {u.lastSignInAt ? (
                    <time dateTime={u.lastSignInAt}>{format.dateTime(new Date(u.lastSignInAt), "short")}</time>
                  ) : (
                    t("Admin.common.never")
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  <time dateTime={u.createdAt}>{format.dateTime(new Date(u.createdAt), "short")}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
