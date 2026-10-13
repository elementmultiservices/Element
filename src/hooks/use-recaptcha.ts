"use client";

import { useCallback, useEffect } from "react";
import { publicEnv } from "@/lib/public-env";

type Grecaptcha = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const SCRIPT_ID = "recaptcha-v3";

function waitForGrecaptcha(timeoutMs = 10_000): Promise<Grecaptcha> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const g = window.grecaptcha;
      if (g) g.ready(() => resolve(g));
      else if (Date.now() - started > timeoutMs) reject(new Error("recaptcha_timeout"));
      else setTimeout(tick, 100);
    };
    tick();
  });
}

/** Adds the reCAPTCHA v3 script once (no-op without a site key). */
export function loadRecaptcha(): void {
  const siteKey = publicEnv.recaptchaSiteKey;
  if (!siteKey || document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/**
 * Loads reCAPTCHA v3 once and returns a function that produces a token for a
 * given action. The token is verified on the server. Without a site key
 * (local development) it returns an empty string. With `lazy`, the script is
 * only loaded when a token is first requested (or loadRecaptcha() is called),
 * for small forms present on every page.
 */
export function useRecaptcha({ lazy = false }: { lazy?: boolean } = {}): (action: string) => Promise<string> {
  const siteKey = publicEnv.recaptchaSiteKey;

  useEffect(() => {
    if (!lazy) loadRecaptcha();
  }, [lazy]);

  return useCallback(
    async (action: string) => {
      if (!siteKey) return "";
      loadRecaptcha();
      try {
        const g = await waitForGrecaptcha();
        return await g.execute(siteKey, { action });
      } catch {
        return "";
      }
    },
    [siteKey],
  );
}
