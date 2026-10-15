import { MapPin } from "lucide-react";
import { BrandMark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

/** Decorative street map. A live map embed would need CSP changes; with `href` the map opens Google Maps instead. */
export function MapIllustration({
  label,
  badge,
  logoPin = false,
  href,
  linkLabel,
  className,
}: {
  label: string;
  /** Small chip in the bottom-right corner (e.g. nearest station). */
  badge?: string;
  /** Use the brand mark instead of a map pin. */
  logoPin?: boolean;
  /** Makes the whole map a link (e.g. to Google Maps), named by `linkLabel`. */
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  const map = (
    <div aria-hidden="true" className={cn("relative h-[340px] overflow-hidden rounded-[28px] bg-[#e8f2fd] sm:h-[440px] lg:rounded-[32px]", className)}>
      <svg viewBox="0 0 600 440" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <path d="M430 -20 C 470 90, 400 170, 460 260 S 520 400, 480 470 L 640 470 L 640 -20 Z" fill="#a1d3fb" opacity="0.7" />
        <g fill="#d4e6fa">
          <rect x="30" y="30" width="110" height="70" rx="10" />
          <rect x="170" y="30" width="90" height="70" rx="10" />
          <rect x="290" y="30" width="110" height="70" rx="10" />
          <rect x="30" y="130" width="110" height="90" rx="10" />
          <rect x="290" y="130" width="100" height="90" rx="10" />
          <rect x="30" y="250" width="70" height="80" rx="10" />
          <rect x="130" y="250" width="130" height="80" rx="10" />
          <rect x="290" y="250" width="110" height="80" rx="10" />
          <rect x="30" y="360" width="230" height="60" rx="10" />
          <rect x="290" y="360" width="120" height="60" rx="10" />
        </g>
        <rect x="170" y="130" width="90" height="90" rx="10" fill="#c5e3fb" />
        <g stroke="#fff" strokeWidth="14" strokeLinecap="round" fill="none">
          <path d="M-10 115 H 440" />
          <path d="M-10 235 H 430" />
          <path d="M-10 345 H 420" />
          <path d="M155 -10 V 450" />
          <path d="M275 -10 V 450" />
        </g>
        <path d="M-20 420 C 120 300, 260 260, 420 120" stroke="#79bcf9" strokeWidth="10" strokeLinecap="round" fill="none" />
      </svg>
      <div className="motion-float absolute top-[44%] left-[36%] flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <span className="mb-2 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_12px_18px_rgba(5,13,41,0.25)]">
          {label}
        </span>
        {logoPin ? (
          <span className="motion-pulse flex size-12 items-center justify-center rounded-2xl bg-electric text-white shadow-[0_14px_24px_rgba(27,131,244,0.35)]">
            <BrandMark mono className="h-6" />
          </span>
        ) : (
          <span className="motion-pulse flex size-11 items-center justify-center rounded-full bg-electric text-white">
            <MapPin className="size-5" />
          </span>
        )}
      </div>
      {badge ? (
        <span className="absolute right-4 bottom-4 rounded-xl bg-white px-3.5 py-2 text-[13px] font-medium text-ink shadow-[0_8px_20px_rgba(5,13,41,0.1)]">
          {badge}
        </span>
      ) : null}
    </div>
  );
  if (!href) return map;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={linkLabel} className="block rounded-[28px] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric lg:rounded-[32px]">
      {map}
    </a>
  );
}
