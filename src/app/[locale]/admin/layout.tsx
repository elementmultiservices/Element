import { setRequestLocale } from "next-intl/server";
import { toLocale } from "@/i18n/routing";
import { PanelShell } from "@/components/layout/panel-shell";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireAdmin();

  return (
    <PanelShell variant="admin" session={session}>
      {children}
    </PanelShell>
  );
}
