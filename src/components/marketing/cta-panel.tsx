import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Closing call-to-action panel used at the end of the marketing pages.
 *   dark   navy gradient with white text
 *   light  pale blue gradient, centered
 */
export function CtaPanel({
  id,
  title,
  body,
  tone = "dark",
  children,
  className,
}: {
  id: string;
  title: string;
  body: string;
  tone?: "dark" | "light";
  children?: ReactNode;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <section aria-labelledby={id} className={cn("px-4 pb-16 sm:px-6 lg:pb-24", className)}>
      <div
        className={cn(
          "reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[28px] px-6 py-14 sm:px-12 lg:rounded-[40px] lg:px-16 lg:py-16",
          dark
            ? "bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] text-white"
            : "bg-[linear-gradient(170deg,#F0F7FF_0%,#C5E3FB_55%,#53A0F8_100%)] text-center",
        )}
      >
        {dark ? (
          <span aria-hidden="true" className="motion-float absolute -top-24 -right-16 size-72 rounded-full bg-sky/20 blur-3xl" />
        ) : null}
        <div className={cn("relative flex flex-col gap-8", dark ? "lg:flex-row lg:items-center lg:justify-between" : "items-center")}>
          <div className={cn("flex max-w-[620px] flex-col gap-4", !dark && "items-center")}>
            <h2
              id={id}
              className={cn(
                "text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-5xl",
                dark ? "text-white" : "text-ink lg:text-[56px]",
              )}
            >
              {title}
            </h2>
            <p className={cn("text-base leading-relaxed sm:text-lg", dark ? "text-azure-100" : "text-navy")}>{body}</p>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
