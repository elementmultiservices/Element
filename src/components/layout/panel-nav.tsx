"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  FolderTree,
  LayoutDashboard,
  Mail,
  MailPlus,
  Menu,
  Newspaper,
  ScrollText,
  Store,
  Trash2,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type PanelVariant = "user" | "admin";

type Item = { href: string; icon: LucideIcon; label: string; exact?: boolean };

function useItems(variant: PanelVariant, canUpload: boolean): Item[] {
  const t = useTranslations("Panel");
  if (variant === "admin") {
    return [
      { href: "/admin", icon: LayoutDashboard, label: t("admin.overview"), exact: true },
      { href: "/admin/users", icon: Users, label: t("admin.users") },
      { href: "/admin/files", icon: FileText, label: t("admin.files") },
      { href: "/admin/trash", icon: Trash2, label: t("admin.trash") },
      { href: "/admin/categories", icon: FolderTree, label: t("admin.categories") },
      { href: "/admin/blog", icon: Newspaper, label: t("admin.blog") },
      { href: "/admin/messages", icon: Mail, label: t("admin.messages") },
      { href: "/admin/subscribers", icon: MailPlus, label: t("admin.subscribers") },
      { href: "/admin/settings", icon: Store, label: t("admin.settings") },
      { href: "/admin/audit", icon: ScrollText, label: t("admin.audit") },
      { href: "/admin/profile", icon: UserRound, label: t("admin.profile") },
    ];
  }
  return [
    { href: "/dashboard", icon: FileText, label: t("user.files"), exact: true },
    ...(canUpload ? [{ href: "/dashboard/upload", icon: Upload, label: t("user.upload") }] : []),
    { href: "/dashboard/profile", icon: UserRound, label: t("user.profile") },
  ];
}

function NavList({ variant, canUpload, onNavigate }: { variant: PanelVariant; canUpload: boolean; onNavigate?: () => void }) {
  const t = useTranslations("Panel");
  const pathname = usePathname();
  const items = useItems(variant, canUpload);

  return (
    <nav aria-label={variant === "admin" ? t("adminNavigation") : t("userNavigation")}>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-electric text-white shadow-[0_8px_20px_rgba(27,131,244,0.35)]"
                    : "text-azure-100 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Fixed sidebar on large screens. */
export function PanelSidebar({ variant, canUpload, footer }: { variant: PanelVariant; canUpload: boolean; footer: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-[linear-gradient(180deg,#050D29_0%,#0B1A44_100%)] lg:flex">
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-royal/30 blur-3xl" />
      <div className="relative flex h-[72px] items-center px-6">
        <Link href="/" className="rounded-sm">
          <Wordmark inverted />
        </Link>
      </div>
      <div className="relative flex-1 overflow-y-auto px-4 py-4">
        <NavList variant={variant} canUpload={canUpload} />
      </div>
      <div className="relative border-t border-white/10 p-4">{footer}</div>
    </aside>
  );
}

/** Off-canvas navigation for small screens. */
export function PanelMobileNav({ variant, canUpload, footer }: { variant: PanelVariant; canUpload: boolean; footer: React.ReactNode }) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-ink lg:hidden">
          <Menu aria-hidden="true" />
          <span className="sr-only">{t("openMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" closeLabel={t("close")} className="w-72 border-none bg-[linear-gradient(180deg,#050D29_0%,#0B1A44_100%)] text-white">
        <SheetTitle className="px-5 pt-5">
          <Wordmark inverted />
        </SheetTitle>
        <div className="px-4 py-4">
          <NavList variant={variant} canUpload={canUpload} onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-auto border-t border-white/10 p-4">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
