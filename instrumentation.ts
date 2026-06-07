import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  console.log("[instrumentation] register() runtime=" + process.env.NEXT_RUNTIME + " dsn_set=" + !!dsn);
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    console.log("[instrumentation] node Sentry.init done");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0.1,
    });
    console.log("[instrumentation] edge Sentry.init done");
  }
}

export const onRequestError = Sentry.captureRequestError;
