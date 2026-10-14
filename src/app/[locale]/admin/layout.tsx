import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { clientMessages } from "@/i18n/client-messages";
import { toLocale } from "@/i18n/routing";
import { PanelShell } from "@/components/layout/panel-shell";
import { Toaster } from "@/components/ui/sonner";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireAdmin();

  return (
    <NextIntlClientProvider messages={await clientMessages("Admin", "Panel", "Profile", "Upload")}>
      <PanelShell variant="admin" session={session}>
        {children}
        <Toaster />
      </PanelShell>
    </NextIntlClientProvider>
  );
}
