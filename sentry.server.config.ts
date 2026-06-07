import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

console.log("[sentry.server.config] loaded, dsn_set=" + !!dsn);

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  console.log("[sentry.server.config] Sentry.init called");
}
