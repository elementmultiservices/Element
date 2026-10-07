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
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, color: "#111827", background: "#f6f7f9" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "4rem 1.5rem" }}>
          <p style={{ color: "#0b2545", fontWeight: 500, letterSpacing: "0.04em", fontSize: 20 }}>Element</p>
          <h1 style={{ color: "#0b2545", fontSize: 24 }}>{m.title}</h1>
          <p style={{ lineHeight: 1.6 }}>{m.body}</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#0b2545", color: "#fff", border: 0, borderRadius: 4, padding: "10px 18px", cursor: "pointer" }}
          >
            {m.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
