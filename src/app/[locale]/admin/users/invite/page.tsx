import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { InviteForm } from "./invite-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/users/invite">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/users/invite", page: "adminInvite", noIndex: true });
}

export default async function InviteUserPage({ params }: PageProps<"/[locale]/admin/users/invite">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  await requireAdmin();
  const t = await getTranslations();

  return (
    <>
      <PageHeader
        title={t("Admin.users.inviteCta")}
        description={t("Admin.users.invite.description")}
        breadcrumbs={[
          { label: t("Panel.adminTitle"), href: "/admin" },
          { label: t("Panel.admin.users"), href: "/admin/users" },
          { label: t("Admin.users.inviteCta") },
        ]}
      />
      <div className="max-w-3xl">
        <InviteForm />
      </div>
    </>
  );
}
