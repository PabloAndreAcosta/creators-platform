/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per IP address.
 *
 * Note: This resets on each serverless cold start. For production
 * at scale, use Upstash Redis or Vercel KV instead.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, value]) => {
    if (now > value.resetAt) store.delete(key);
  });
}, 60_000);

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Get rate limit key from request (uses IP + optional prefix).
 */
export function getRateLimitKey(req: Request, prefix: string = ""): string {
  // Prefer x-real-ip (set by Vercel's edge to the true client IP). A client can
  // prepend its own value to x-forwarded-for, so the LEFTMOST XFF entry is
  // spoofable — fall back to the last (proxy-appended) entry, not the first.
  const realIp = req.headers.get("x-real-ip")?.trim();
  const xffLast = req.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  const ip = realIp || xffLast || "unknown";
  return `${prefix}:${ip}`;
}
