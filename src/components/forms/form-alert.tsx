import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "error" | "success" | "info";

const styles: Record<Variant, string> = {
  error: "border-destructive/30 bg-error-bg text-destructive",
  success: "border-success/30 bg-success-bg text-success",
  info: "border-info/30 bg-info-bg text-info",
};

const icons = { error: AlertCircle, success: CheckCircle2, info: Info } as const;

export function FormAlert({ variant, children, className }: { variant: Variant; children: React.ReactNode; className?: string }) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed", styles[variant], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
