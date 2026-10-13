import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { delay } from "./motion";

/**
 * Pale-blue rounded hero used at the top of the secondary pages (about,
 * contact, legal…). Enters with the same staggered motion as the home hero.
 */
export function PageHero({
  eyebrow,
  title,
  accent,
  body,
  align = "left",
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  /** Optional second line in the brand blue. */
  accent?: string;
  body?: string;
  align?: "left" | "center";
  children?: ReactNode;
  className?: string;
}) {
  const center = align === "center";
  return (
    <section className={cn("px-4 pt-4 sm:px-6", className)}>
      <div
        className={cn(
          "relative mx-auto flex max-w-[1240px] flex-col gap-5 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#F0F7FF_0%,#DDEEFD_100%)] px-6 py-14 sm:px-12 lg:rounded-[40px] lg:py-20",
          center && "items-center text-center",
        )}
      >
        <span aria-hidden="true" className="motion-float absolute -top-32 -right-24 size-80 rounded-full bg-white/70 blur-3xl" />
        <span aria-hidden="true" className="motion-float absolute -bottom-32 -left-24 size-72 rounded-full bg-azure-200/50 blur-3xl [animation-delay:-3s]" />
        {eyebrow ? (
          <p style={delay(0)} className="motion-enter relative text-[15px] text-graphite">
            {eyebrow}
          </p>
        ) : null}
        <h1
          style={delay(1)}
          className="motion-enter relative max-w-[900px] text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] text-ink sm:text-[56px] lg:text-[68px]"
        >
          {title}
          {accent ? (
            <>
              <br />
              <span className="text-electric">{accent}</span>
            </>
          ) : null}
        </h1>
        {body ? (
          <p style={delay(2)} className="motion-enter relative max-w-[640px] text-base leading-relaxed text-graphite sm:text-lg">
            {body}
          </p>
        ) : null}
        {children ? (
          <div style={delay(3)} className="motion-enter relative">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
