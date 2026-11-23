import * as Sentry from "@sentry/nextjs";
import { appSkalTaggar } from "@/lib/sentry-app";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [],
    // Appskalet (Capacitor) laddar samma sida; taggen skiljer appens fel från webbläsarens.
    initialScope: { tags: appSkalTaggar(typeof window === "undefined" ? undefined : window) },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
