"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Inertial wheel/trackpad scrolling for the public site. The page keeps native
 * scrolling (scroll-driven CSS animations still work) and touch devices keep
 * their own momentum. Skipped entirely for reduced-motion visitors.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      anchors: { offset: -96 },
    });
    return () => lenis.destroy();
  }, []);

  return null;
}
