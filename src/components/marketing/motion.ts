import type { CSSProperties } from "react";

/** Entrance delay step for `.motion-enter*` (multiples of 110ms). */
export const delay = (d: number) => ({ "--d": d }) as CSSProperties;

/** Scroll-reveal stagger for `.reveal` siblings that enter the viewport together. */
export const stagger = (i: number) => ({ "--i": i }) as CSSProperties;
