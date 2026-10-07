import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ProfileView } from "@/components/profile/profile-view";
import { toLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/profile">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/admin/profile", page: "profile", noIndex: true });
}

export default async function AdminProfilePage({ params }: PageProps<"/[locale]/admin/profile">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireAdmin();
  return <ProfileView session={session} />;
}
