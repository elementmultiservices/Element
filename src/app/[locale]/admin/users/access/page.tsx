import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { TableShell, Th } from "@/components/tables/table-kit";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { listUploadGrants, userLabels } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { PreauthorizeForm, RemoveGrantButton } from "./access-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/users/access">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/users/access", page: "adminUploadAccess", noIndex: true });
}

export default async function UploadAccessPage({ params }: PageProps<"/[locale]/admin/users/access">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const grants = await listUploadGrants(supabase);
  const labels = await userLabels(supabase, grants.map((g) => g.grantedBy));

  return (
    <>
      <PageHeader
        title={t("Admin.users.upload.pageTitle")}
        description={t("Admin.users.upload.pageDescription")}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.users"), href: "/admin/users" },
          { label: t("Admin.users.upload.pageTitle") },
        ]}
      />

      <div className="max-w-3xl">
        <PreauthorizeForm />
        <p className="mt-3 text-sm text-muted-foreground">
          {t("Admin.users.upload.existingHint")}{" "}
          <Link href="/admin/users?upload=no" className="text-link hover:underline">
            {t("Admin.users.upload.existingLink")}
          </Link>
        </p>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg">{t("Admin.users.upload.pendingHeading")}</h2>
        {grants.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
            {t("Admin.users.upload.pendingEmpty")}
          </p>
        ) : (
          <TableShell caption={t("Admin.users.upload.pendingHeading")}>
            <thead className="border-b bg-surface">
              <tr>
                <Th>{t("Admin.users.table.email")}</Th>
                <Th>{t("Admin.users.upload.grantedBy")}</Th>
                <Th>{t("Admin.users.upload.grantedAt")}</Th>
                <Th>
                  <span className="sr-only">{t("Admin.users.upload.remove")}</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grants.map((g) => {
                const by = g.grantedBy ? labels.get(g.grantedBy) : undefined;
                return (
                  <tr key={g.email} className="hover:bg-surface/60">
                    <td className="max-w-72 truncate px-3 py-2.5 font-medium" title={g.email}>
                      {g.email}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{by ? by.fullName.trim() || by.email : t("Admin.common.system")}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      <time dateTime={g.createdAt}>{format.dateTime(new Date(g.createdAt), "short")}</time>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <RemoveGrantButton email={g.email} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
