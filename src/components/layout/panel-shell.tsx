import { getTranslations } from "next-intl/server";
import type { SessionContext } from "@/lib/auth/session";
import { LanguageSwitcher } from "./language-switcher";
import { PanelMobileNav, PanelSidebar, type PanelVariant } from "./panel-nav";
import { SignOutButton } from "./sign-out-button";

/** Authenticated layout: fixed sidebar, top bar and main content area. */
export async function PanelShell({
  variant,
  session,
  children,
}: {
  variant: PanelVariant;
  session: SessionContext;
  children: React.ReactNode;
}) {
  const t = await getTranslations("Panel");
  const displayName = session.fullName || session.email || "";

  const footer = (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-primary-foreground">{displayName}</p>
        <p className="text-xs text-primary-foreground/70">{t(`roles.${session.role}`)}</p>
      </div>
      <SignOutButton
        variant="outline"
        className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <PanelSidebar variant={variant} canUpload={session.canUpload} footer={footer} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <PanelMobileNav variant={variant} canUpload={session.canUpload} footer={footer} />
            <span className="text-sm font-semibold text-primary">
              {variant === "admin" ? t("adminTitle") : t("dashboardTitle")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
              {t("signedInAs", { name: displayName })}
            </span>
            <LanguageSwitcher />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
