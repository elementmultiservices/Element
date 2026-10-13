import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const container = "mx-auto w-full max-w-[1240px] px-4 sm:px-6";

/** Eyebrow + heading + optional lead paragraph shared by the home sections. */
export function SectionIntro({
  eyebrow,
  title,
  body,
  align = "left",
  tone = "light",
  id,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("reveal flex flex-col gap-4", align === "center" && "items-center text-center", className)}>
      <p className={cn("text-[15px]", tone === "dark" ? "text-azure-200" : "text-graphite")}>{eyebrow}</p>
      <h2
        id={id}
        className={cn(
          "text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-5xl lg:text-[56px]",
          tone === "dark" ? "text-white" : "text-ink",
        )}
      >
        {title}
      </h2>
      {body ? (
        <p className={cn("max-w-[560px] text-base leading-relaxed sm:text-lg", tone === "dark" ? "text-azure-100" : "text-graphite")}>
          {body}
        </p>
      ) : null}
    </div>
  );
}
