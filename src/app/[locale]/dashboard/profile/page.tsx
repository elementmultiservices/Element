import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ProfileView } from "@/components/profile/profile-view";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/profile">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard/profile", page: "profile", noIndex: true });
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/dashboard/profile">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  return <ProfileView session={session} />;
}
