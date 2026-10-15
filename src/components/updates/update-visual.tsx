import { FileText, Landmark, Lightbulb, Megaphone, type LucideIcon } from "lucide-react";
import type { IrsCategory } from "@/lib/irs/newsroom";
import { cn } from "@/lib/utils";

/** "Consejo tributario del IRS 2026-74SP" -> "2026-74SP"; "IR-2026-84" stays. */
const shortCode = (code: string) => /(?:[A-Z]{2,3}-)?\d{4}-\d+[A-Z]*$/.exec(code)?.[0] ?? code;

const ICONS: Record<IrsCategory, LucideIcon> = {
  "news-release": Megaphone,
  "tax-tip": Lightbulb,
  "fact-sheet": FileText,
};

/**
 * Decorative cover for an IRS update, in the style of the home hero: light
 * brand gradient, soft glows and a floating "newsroom document" card.
 */
export function UpdateVisual({ category, label, code, className }: { category: IrsCategory; label: string; code: string | null; className?: string }) {
  const Icon = ICONS[category];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-[linear-gradient(165deg,#F0F7FF_0%,#C5E3FB_42%,#53A0F8_82%,#3167DB_100%)] px-6 py-10",
        className,
      )}
    >
      <span className="motion-float absolute -top-20 -right-16 size-64 rounded-full bg-white/50 blur-3xl" />
      <span className="motion-float absolute -bottom-24 -left-12 size-64 rounded-full bg-royal/30 blur-3xl [animation-delay:-3s]" />

      <div className="relative w-full max-w-[340px] -rotate-2 rounded-[22px] bg-white p-5 shadow-[0_32px_48px_rgba(5,13,41,0.22)] transition-transform duration-700 group-hover:rotate-0">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-graphite">
            <Landmark className="size-4 text-cobalt" strokeWidth={1.75} />
            IRS NEWSROOM
          </span>
          <span className="size-2 rounded-full bg-electric" />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-[linear-gradient(135deg,#13295A_0%,#3167DB_100%)] p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon className="size-5 text-white" strokeWidth={1.75} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-white">{label}</span>
            {code ? <span className="truncate font-mono text-[11px] text-white/70">{shortCode(code)}</span> : null}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <span className="h-2 w-full rounded-full bg-azure-50" />
          <span className="h-2 w-11/12 rounded-full bg-azure-50" />
          <span className="h-2 w-3/5 rounded-full bg-azure-50" />
        </div>
      </div>

      <span className="motion-float absolute right-6 bottom-6 flex size-11 items-center justify-center rounded-full bg-ink shadow-[0_12px_18px_rgba(5,13,41,0.25)] [animation-delay:-2s]">
        <Icon className="size-5 text-sky" strokeWidth={1.75} />
      </span>
    </div>
  );
}
