import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const err = new Error("Sentry integration test — usha.se " + new Date().toISOString());
  Sentry.captureException(err);
  await Sentry.flush(2000);
  throw err;
}
