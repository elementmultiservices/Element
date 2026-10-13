"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Last-resort error boundary (replaces the root layout, so no providers are
 * available). Copy comes from the message files; never shows error details.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  const locale = pathname?.startsWith("/es") ? "es" : "en";
  const m = (locale === "es" ? es : en).ErrorPage;

  return (
    <html lang={locale}>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, color: "#050d29", background: "#f7fbff" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "4rem 1.5rem" }}>
          <p style={{ color: "#1b83f4", fontWeight: 600, fontSize: 20 }}>Element</p>
          <h1 style={{ color: "#050d29", fontSize: 32, letterSpacing: "-0.02em" }}>{m.title}</h1>
          <p style={{ lineHeight: 1.6 }}>{m.body}</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#1b83f4", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600, cursor: "pointer" }}
          >
            {m.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
