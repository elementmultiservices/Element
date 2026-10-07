import * as Sentry from "@sentry/nextjs";

/** Server/edge monitoring. Inactive unless NEXT_PUBLIC_SENTRY_DSN is set. */
export async function register() {
  const { sentryBaseOptions } = await import("@/lib/monitoring/scrub");
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryBaseOptions);
  }
}

// Unhandled errors in server components, route handlers and server actions.
export const onRequestError = Sentry.captureRequestError;
