import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Verify a cron/automation request's bearer token against CRON_SECRET.
 *
 * Fail-CLOSED: if CRON_SECRET is unset (removed, misspelled, a fresh Vercel env,
 * a preview deploy) this returns false. The previous inline check compared against
 * `Bearer ${process.env.CRON_SECRET}`, which becomes the literal "Bearer undefined"
 * when the env is missing — anyone sending that header would authenticate and could
 * trigger mass emails / Facebook posts. Comparison is constant-time.
 */
export function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
