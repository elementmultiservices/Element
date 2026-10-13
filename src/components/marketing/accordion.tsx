"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccordionItem = { q: string; a: ReactNode };

const ease = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * One-at-a-time accordion. The panel height animates with the grid-rows
 * (0fr → 1fr) technique, so it works with content of any length; the answer
 * fades and slides in slightly behind it.
 *   lines  rows separated by rules (home page)
 *   cards  each question in its own card (help center)
 */
export function Accordion({
  items,
  variant = "lines",
  defaultOpen = 0,
  className,
}: {
  items: AccordionItem[];
  variant?: "lines" | "cards";
  defaultOpen?: number | null;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const id = useId();
  const cards = variant === "cards";

  return (
    <div className={cn(cards ? "flex flex-col gap-3" : "border-t border-azure-50", className)}>
      {items.map(({ q, a }, i) => {
        const isOpen = open === i;
        const buttonId = `${id}-q${i}`;
        const panelId = `${id}-a${i}`;
        return (
          <div
            key={q}
            className={cn(
              cards
                ? cn(
                    "rounded-[20px] border bg-white px-5 transition-[border-color,box-shadow] duration-500 sm:px-6",
                    isOpen ? "border-azure-100 shadow-[0_18px_40px_rgba(5,13,41,0.06)]" : "border-azure-50 hover:border-azure-100",
                  )
                : "border-b border-azure-50",
            )}
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className={cn(
                  "group flex w-full items-center justify-between gap-4 text-left font-semibold transition-colors duration-300",
                  cards ? "py-4 text-base sm:text-[17px]" : "py-5 text-lg",
                  isOpen ? "text-electric" : "text-ink hover:text-electric",
                )}
              >
                {q}
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,rotate] duration-500",
                    ease,
                    cards ? "size-8" : "size-9",
                    isOpen
                      ? "rotate-[135deg] bg-electric text-white"
                      : cards
                        ? "bg-electric/10 text-electric group-hover:bg-electric/20"
                        : "bg-azure-25 text-ink group-hover:bg-azure-50",
                  )}
                >
                  <Plus aria-hidden="true" className="size-4" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={cn("grid transition-[grid-template-rows] duration-500", ease, isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="overflow-hidden">
                <div
                  className={cn(
                    "text-base leading-relaxed text-graphite transition-[opacity,translate] duration-500",
                    ease,
                    cards ? "pb-5" : "pr-12 pb-6",
                    isOpen ? "translate-y-0 opacity-100 delay-100" : "-translate-y-2 opacity-0",
                  )}
                >
                  {a}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
