import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = Sentry.getClient();
  const status = {
    dsn_env_set: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    dsn_prefix: process.env.NEXT_PUBLIC_SENTRY_DSN?.slice(0, 30) ?? null,
    client_initialized: !!client,
    client_dsn: client?.getDsn()?.host ?? null,
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
  };
  const err = new Error("Sentry integration test — usha.se " + new Date().toISOString());
  const eventId = Sentry.captureException(err);
  const flushed = await Sentry.flush(3000);
  return NextResponse.json({ ...status, captured_event_id: eventId, flushed }, { status: 500 });
}
