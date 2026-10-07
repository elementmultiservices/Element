import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/monitoring/scrub";

/**
 * Browser monitoring. Inactive unless NEXT_PUBLIC_SENTRY_DSN is set. No
 * session replay; events are scrubbed of personal data and file names and are
 * sent through the same-origin tunnel (/monitoring), allowed by the CSP.
 */
Sentry.init({ ...sentryBaseOptions, integrations: [] });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
