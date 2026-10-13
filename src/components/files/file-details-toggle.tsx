"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mobile file card actions: a details toggle next to the other actions, with the details panel below them. */
export function FileDetailsToggle({
  label,
  ariaLabel,
  actions,
  children,
}: {
  label: string;
  ariaLabel: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={ariaLabel}
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
            open ? "border-electric bg-azure-25 text-electric" : "border-azure-100 text-ink hover:bg-azure-25",
          )}
        >
          <Info aria-hidden="true" className="size-4" />
          <span className="max-[339px]:sr-only">{label}</span>
        </button>
        {actions}
      </div>
      <div id={panelId} hidden={!open} className="mt-3 rounded-2xl bg-surface px-4 py-3">
        {children}
      </div>
    </>
  );
}
