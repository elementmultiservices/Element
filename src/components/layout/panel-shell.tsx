import { getTranslations } from "next-intl/server";
import type { SessionContext } from "@/lib/auth/session";
import { LanguageSwitcher } from "./language-switcher";
import { PanelMobileNav, PanelSidebar, type PanelVariant } from "./panel-nav";
import { SignOutButton } from "./sign-out-button";

const initials = (name: string) =>
  name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

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
      <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/6 p-3 ring-1 ring-white/10">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-electric font-mono text-xs font-medium text-white">
          {initials(displayName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
          <span className="block font-mono text-[11px] tracking-[0.06em] text-azure-300 uppercase">{t(`roles.${session.role}`)}</span>
        </span>
      </div>
      <SignOutButton variant="outline" className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" />
    </div>
  );

  return (
    <div className="min-h-screen bg-mist">
      <PanelSidebar variant={variant} canUpload={session.canUpload} footer={footer} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-azure-50 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <PanelMobileNav variant={variant} canUpload={session.canUpload} footer={footer} />
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span aria-hidden="true" className="size-2 rounded-full bg-electric" />
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
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-10">
          <div className="motion-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
