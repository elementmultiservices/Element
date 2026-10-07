import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  pending,
  label,
  pendingLabel,
  className,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} className={cn("h-10 w-full", className)}>
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}
