import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const isProduction = process.env.NODE_ENV === "production";

/**
 * Static security headers for every response. The Content-Security-Policy is
 * per request (nonce) and is set in src/proxy.ts.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Remind about Next.js releases that fix a published security advisory.
    agentUpgrade: "security",
  },
  // Pages that were removed: keep old links working.
  async redirects() {
    return [
      { source: "/:locale(en|es)/about", destination: "/:locale", permanent: true },
      { source: "/:locale(en|es)/contact", destination: "/:locale/location#contact-form", permanent: true },
      // The blog was replaced by the IRS updates page.
      { source: "/:locale(en|es)/blog/:slug*", destination: "/:locale/updates", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Same-origin tunnel: avoids ad blockers and keeps the CSP connect-src at 'self'.
  tunnelRoute: "/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  telemetry: false,
});
