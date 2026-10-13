import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/wordmark";
import { delay } from "@/components/marketing/motion";
import { cn } from "@/lib/utils";

/** Full-width status message (404, errors) in the brand's hero style. */
export function StatusView({
  code,
  title,
  body,
  children,
  className,
}: {
  code?: string;
  title: string;
  body: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-6 sm:px-6", className)}>
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-5 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#F0F7FF_0%,#DDEEFD_100%)] px-6 py-20 text-center lg:rounded-[40px] lg:py-28">
        <span aria-hidden="true" className="motion-float absolute -top-32 -right-24 size-80 rounded-full bg-white/70 blur-3xl" />
        <span aria-hidden="true" className="motion-float absolute -bottom-32 -left-24 size-72 rounded-full bg-azure-200/50 blur-3xl [animation-delay:-3s]" />
        <span className="motion-enter-scale relative flex size-16 items-center justify-center rounded-2xl bg-white shadow-[0_18px_40px_rgba(5,13,41,0.1)]">
          <BrandMark className="h-8" />
        </span>
        {code ? (
          <p style={delay(1)} className="motion-enter relative font-mono text-sm tracking-[0.14em] text-electric uppercase">
            {code}
          </p>
        ) : null}
        <h1
          style={delay(2)}
          className="motion-enter relative max-w-[720px] text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] text-ink sm:text-6xl"
        >
          {title}
        </h1>
        <p style={delay(3)} className="motion-enter relative max-w-[520px] text-base leading-relaxed text-graphite sm:text-lg">
          {body}
        </p>
        {children ? (
          <div style={delay(4)} className="motion-enter relative mt-2 flex flex-wrap justify-center gap-3">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
