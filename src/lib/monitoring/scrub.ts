import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Removes personal data and file names from Sentry events before they leave
 * the process (server or browser). Events keep only what is needed to debug:
 * error types, messages and stack traces with sensitive substrings redacted,
 * the route path (no query string) and the release.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const FILE_NAME = /[^\s"'`/\\<>|:*?]+\.(?:pdf|docx?|xlsx?|pptx?|jpe?g|png|webp|csv|zip|exe)\b/gi;
const TOKENS = /\b(token_hash|token|code|access_token|refresh_token|apikey|key)=([^&\s]+)/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const IP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

export function redact(text: string): string {
  return text
    .replace(JWT, "[jwt]")
    .replace(TOKENS, "$1=[redacted]")
    .replace(EMAIL, "[email]")
    .replace(FILE_NAME, "[file]")
    .replace(IP, "[ip]");
}

/** Keeps only the path of a URL (no query string or fragment), redacted. */
export function stripUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  const path = url.split(/[?#]/)[0] ?? "";
  return redact(path);
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.server_name;

  if (event.request) {
    event.request = { method: event.request.method, url: stripUrl(event.request.url) };
  }
  if (event.message) event.message = redact(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
    }
  }

  if (event.contexts) {
    // Device/OS/runtime contexts are fine; anything custom is dropped.
    const { os, browser, runtime, device, trace, response } = event.contexts;
    event.contexts = { os, browser, runtime, device, trace, ...(response ? { response: { status_code: response.status_code } } : {}) };
  }

  event.breadcrumbs = (event.breadcrumbs ?? []).map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output and UI interactions can contain user-entered text.
  if (breadcrumb.category === "console" || breadcrumb.category?.startsWith("ui.")) return null;
  const out: Breadcrumb = { ...breadcrumb };
  if (out.message) out.message = redact(out.message);
  if (out.data) {
    const { method, status_code, url, from, to } = out.data as Record<string, unknown>;
    out.data = {
      ...(typeof method === "string" ? { method } : {}),
      ...(typeof status_code === "number" ? { status_code } : {}),
      ...(typeof url === "string" ? { url: stripUrl(url) } : {}),
      ...(typeof from === "string" ? { from: stripUrl(from) } : {}),
      ...(typeof to === "string" ? { to: stripUrl(to) } : {}),
    };
  }
  return out;
}

export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
