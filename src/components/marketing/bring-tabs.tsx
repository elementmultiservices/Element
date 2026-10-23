"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible tabs (WAI-ARIA pattern) for the "What to bring" checklists. */
export function BringTabs({ label, tabs }: { label: string; tabs: { key: string; label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const id = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="mx-auto mb-10 flex w-fit gap-1 rounded-full bg-azure-25 p-1.5">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors sm:px-7",
              i === active ? "bg-white text-ink shadow-sm" : "text-graphite hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.key} id={`${id}-panel-${i}`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`} hidden={i !== active}>
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
