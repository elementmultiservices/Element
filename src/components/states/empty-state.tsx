import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[24px] border border-dashed border-azure-100 bg-white px-6 py-14 text-center", className)}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-azure-25">
        <Icon aria-hidden="true" className="size-6 text-electric" />
      </span>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
