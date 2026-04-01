import crypto from "crypto";

const SECRET = process.env.BANKID_COOKIE_SECRET || "";

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

export function hashPersonalNumber(nin: string): string {
  return crypto.createHash("sha256").update(nin).digest("hex");
}
