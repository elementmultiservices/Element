"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type OwnerOption = { id: string; label: string };

const MAX_RESULTS = 50;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Searchable user picker (ARIA combobox). Filters by name or email, ignoring
 * accents and case, and submits the selected id through a hidden `name` input.
 */
export function OwnerPicker({
  id,
  name,
  owners,
  defaultOwnerId,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  owners: OwnerOption[];
  defaultOwnerId?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("Admin.files");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(defaultOwnerId ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = owners.find((o) => o.id === selectedId);
  const indexed = useMemo(() => owners.map((o) => ({ ...o, key: normalize(o.label) })), [owners]);
  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return terms.length ? indexed.filter((o) => terms.every((term) => o.key.includes(term))) : indexed;
  }, [indexed, query]);
  const matches = filtered.slice(0, MAX_RESULTS);

  function pick(ownerId: string) {
    setSelectedId(ownerId);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    setSelectedId("");
    setQuery("");
    setActive(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the upload form from the search box.
      e.preventDefault();
      if (open && matches[active]) pick(matches[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedId} />
      {selected ? (
        <div
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-xl border border-input bg-white px-3.5 py-1.5 text-sm",
            invalid && "border-destructive",
          )}
        >
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
          <span id={id} className="min-w-0 flex-1 truncate font-medium" aria-describedby={describedBy}>
            {selected.label}
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clear}>
            <X aria-hidden="true" />
            {t("ownerChange")}
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={id}
              type="search"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              placeholder={t("ownerSearchPlaceholder")}
              value={query}
              disabled={disabled}
              className="pl-10"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
            />
          </div>
          {open ? (
            <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-azure-50 bg-white shadow-lg">
              <ul id={listId} role="listbox" aria-label={t("ownerLabel")} className="max-h-72 overflow-y-auto py-1">
                {matches.length === 0 ? (
                  <li className="px-3.5 py-3 text-sm text-muted-foreground">{t("ownerNoResults")}</li>
                ) : (
                  matches.map((o, i) => (
                    <li
                      key={o.id}
                      id={`${listId}-${o.id}`}
                      role="option"
                      aria-selected={i === active}
                      // mousedown fires before the input blurs, so the pick isn't lost.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(o.id);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cn("cursor-pointer truncate px-3.5 py-2 text-sm", i === active && "bg-azure-50")}
                    >
                      {o.label}
                    </li>
                  ))
                )}
              </ul>
              {filtered.length > matches.length ? (
                <p className="border-t border-azure-50 px-3.5 py-2 text-xs text-muted-foreground">
                  {t("ownerMoreResults", { shown: matches.length, total: filtered.length })}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
