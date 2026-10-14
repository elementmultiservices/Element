"use client";

import { useEffect } from "react";
import "lenis/dist/lenis.css";

/**
 * Inertial wheel/trackpad scrolling for the public site. The page keeps native
 * scrolling (scroll-driven CSS animations still work) and touch devices keep
 * their own momentum. The library is loaded after hydration and only for
 * devices with a fine pointer; skipped entirely for reduced-motion visitors.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let destroyed = false;
    let lenis: { destroy(): void } | undefined;
    import("lenis").then(({ default: Lenis }) => {
      if (destroyed) return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.1,
        anchors: { offset: -96 },
      });
    });
    return () => {
      destroyed = true;
      lenis?.destroy();
    };
  }, []);

  return null;
}
