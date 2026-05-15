import crypto from "crypto";

const SECRET = process.env.BANKID_COOKIE_SECRET || "";

if (typeof window === "undefined" && !SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BANKID_COOKIE_SECRET must be set in production. Refusing to sign cookies or hash personal numbers with an empty key."
    );
  }
  console.warn("WARNING: BANKID_COOKIE_SECRET is not set. Cookie signing is insecure (dev only).");
}

export function signCookieValue(data: object): string {
  const json = JSON.stringify(data);
  const encoded = Buffer.from(json).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyCookieValue<T = unknown>(
  signedValue: string
): T | null {
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot === -1) return null;

  const encoded = signedValue.slice(0, lastDot);
  const signature = signedValue.slice(lastDot + 1);

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Hash a personal number using HMAC with a secret key.
 * This prevents rainbow table attacks against the predictable
 * Swedish personal number format (YYYYMMDD-XXXX).
 */
export function hashPersonalNumber(nin: string): string {
  if (!SECRET) {
    throw new Error(
      "Cannot hash personal number: BANKID_COOKIE_SECRET is not set. Fail-closed to prevent key-reuse with service-role key."
    );
  }
  return crypto.createHmac("sha256", SECRET).update(nin).digest("hex");
}
