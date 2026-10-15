"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CalendarDays, Languages, Pause, Play, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = { irs: BadgeCheck, notary: Stamp, languages: Languages, yearRound: CalendarDays };

type Item = { key: keyof typeof icons; label: string };

/** Speed while hovered or focused, as a fraction of the normal speed. */
const SLOW_RATE = 0.3;
/** Seconds the speed takes to settle (roughly) after a change. */
const EASE_SECONDS = 0.6;

/** Credentials strip that scrolls continuously; slows on hover or focus and stops with the toggle, easing between speeds. */
export function TrustTicker({
  items,
  label,
  pauseLabel,
  playLabel,
}: {
  items: Item[];
  label: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const target = paused ? 0 : hovered || focused ? SLOW_RATE : 1;

  // Ease the CSS animation's playbackRate toward the target instead of jumping to it.
  useEffect(() => {
    // No animation under reduced motion, so there is nothing to ease.
    const animation = trackRef.current?.getAnimations()[0];
    if (!animation) return;

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const rate = animation.playbackRate;
      const next = rate + (target - rate) * (1 - Math.exp((-dt * 5) / EASE_SECONDS));
      if (Math.abs(target - next) < 0.005) {
        animation.playbackRate = target;
        return;
      }
      animation.playbackRate = next;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // Four identical rows; the track moves by exactly one row (-25%) per loop.
  const rows = [0, 1, 2, 3];

  return (
    <section
      aria-label={label}
      data-paused={paused}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      className="ticker relative border-y border-azure-50 bg-mist"
    >
      <div className="overflow-hidden motion-safe:[mask-image:linear-gradient(90deg,transparent,#000_6%,#000_90%,transparent)]">
        {/* With reduced motion only the first row shows, centered and wrapping. */}
        <div ref={trackRef} className="ticker-track flex w-max motion-reduce:w-auto motion-reduce:justify-center">
          {rows.map((row) => (
            <ul
              key={row}
              aria-hidden={row > 0 || undefined}
              className={cn(
                "flex shrink-0 items-center gap-x-14 gap-y-3 py-[22px] pr-14 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:px-4 lg:py-[26px]",
                row > 0 && "motion-reduce:hidden",
              )}
            >
              {items.map(({ key, label: text }) => {
                const Icon = icons[key];
                return (
                  <li key={key} className="flex shrink-0 items-center gap-2.5 text-[15px] font-medium whitespace-nowrap text-navy">
                    <Icon aria-hidden="true" className="size-5 text-cobalt" />
                    {text}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? playLabel : pauseLabel}
        className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-azure-100 bg-white text-navy opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 motion-reduce:hidden sm:right-4"
      >
        {paused ? <Play aria-hidden="true" className="size-3.5" /> : <Pause aria-hidden="true" className="size-3.5" />}
      </button>
    </section>
  );
}
