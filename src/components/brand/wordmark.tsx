import { cn } from "@/lib/utils";

/**
 * Element wordmark. Single source of the brand mark: replace the contents of
 * this component with the official logo when it exists.
 */
export function Wordmark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span
      className={cn(
        "text-xl font-medium tracking-[0.04em] select-none",
        inverted ? "text-primary-foreground" : "text-primary",
        className,
      )}
    >
      Element
    </span>
  );
}
