import { cn } from "@/lib/utils";
import { MARK_MIDDLE, MARK_OUTER, TAGLINE, WORD } from "./logo-paths";

/**
 * Element wordmark. Single source of the brand mark. The "Element" lettering
 * uses the current text color so the logo works on light and dark surfaces.
 */
export function Wordmark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg
      role="img"
      aria-label="Element Multiservices"
      viewBox="0 0 162 30"
      className={cn("h-[30px] w-auto shrink-0 select-none", inverted ? "text-white" : "text-[#020C27]", className)}
    >
      <path fill="#166BDF" d={MARK_OUTER} />
      <path fill="#309FFD" d={MARK_MIDDLE} />
      <path fill="#309FFD" d={TAGLINE} />
      <path fill="currentColor" d={WORD} />
    </svg>
  );
}

/** The three-bar mark on its own (favicon shape). `mono` draws it in the current text color. */
export function BrandMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 25.776 30" className={cn("shrink-0", className)}>
      <path fill={mono ? "currentColor" : "#166BDF"} d={MARK_OUTER} />
      <path fill={mono ? "currentColor" : "#309FFD"} opacity={mono ? 0.75 : 1} d={MARK_MIDDLE} />
    </svg>
  );
}
