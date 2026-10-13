import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled like Input: fully keyboard/screen-reader accessible and works without JS. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-white px-3.5 text-sm text-ink outline-none",
        "focus-visible:border-electric focus-visible:ring-[3px] focus-visible:ring-electric/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
