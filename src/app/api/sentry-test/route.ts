export const dynamic = "force-dynamic";

export async function GET() {
  throw new Error("Sentry integration test — usha.se " + new Date().toISOString());
}
