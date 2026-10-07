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

/**
 * Loads reCAPTCHA v3 once and returns a function that produces a token for a
 * given action. The token is verified on the server. Without a site key
 * (local development) it returns an empty string.
 */
export function useRecaptcha(): (action: string) => Promise<string> {
  const siteKey = publicEnv.recaptchaSiteKey;

  useEffect(() => {
    if (!siteKey || document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [siteKey]);

  return useCallback(
    async (action: string) => {
      if (!siteKey) return "";
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
