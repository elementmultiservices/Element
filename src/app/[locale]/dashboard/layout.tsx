import { setRequestLocale } from "next-intl/server";
import { PanelShell } from "@/components/layout/panel-shell";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  if (session.role === "admin") redirect({ href: "/admin", locale: toLocale(locale) });

  return (
    <PanelShell variant="user" session={session}>
      {children}
    </PanelShell>
  );
}
