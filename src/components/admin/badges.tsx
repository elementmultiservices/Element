import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export async function UserStatusBadge({ isActive, invitationPending }: { isActive: boolean; invitationPending: boolean }) {
  const t = await getTranslations("Admin.statuses");
  const status = !isActive ? "inactive" : invitationPending ? "pending" : "active";
  const styles = {
    active: "border-success/30 bg-success-bg text-success",
    inactive: "border-destructive/30 bg-error-bg text-destructive",
    pending: "border-warning/30 bg-warning-bg text-warning",
  } as const;
  return (
    <Badge variant="outline" className={cn("font-normal", styles[status])}>
      {t(status)}
    </Badge>
  );
}

export async function RoleBadge({ role }: { role: "user" | "admin" }) {
  const t = await getTranslations("Panel.roles");
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", role === "admin" ? "border-primary/30 bg-accent text-primary" : "text-muted-foreground")}>
      {role === "admin" ? <ShieldCheck aria-hidden="true" className="size-3" /> : null}
      {t(role)}
    </Badge>
  );
}
