import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "oauth_state";
const SECRET = process.env.BANKID_COOKIE_SECRET || "";

// Skip during `next build` page-data collection (NEXT_PHASE), where runtime
// secrets aren't (and shouldn't be) present — e.g. isolated Preview builds.
// The guard still fires at request time in production, preserving fail-closed.
if (
  typeof window === "undefined" &&
  !SECRET &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  throw new Error(
    "BANKID_COOKIE_SECRET must be set in production. Refusing to sign OAuth state cookies with an empty key (no fallback to service-role)."
  );
}

export function setOAuthStateCookie(
  response: NextResponse,
  userId: string,
  csrf?: string
): NextResponse {
  const csrfToken = csrf ?? crypto.randomBytes(16).toString("hex");
  const payload = JSON.stringify({ userId, csrf: csrfToken });
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  const value = Buffer.from(payload).toString("base64") + "." + signature;

  response.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}

export function getOAuthStateFromCookie(request: NextRequest): { userId: string; csrf: string } | null {
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  const [encodedPayload, signature] = cookie.split(".");
  if (!encodedPayload || !signature) return null;

  const payload = Buffer.from(encodedPayload, "base64").toString("utf-8");
  const expectedSig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const data = JSON.parse(payload);
    if (!data.userId || !data.csrf) return null;
    return { userId: data.userId, csrf: data.csrf };
  } catch {
    return null;
  }
}

export function clearOAuthStateCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}

// --- Facebook pages cookie (signed, httpOnly) ---

const FB_PAGES_COOKIE = "fb_pages";

export interface FbPagesPayload {
  pages: Array<{ id: string; name: string; token: string }>;
  fbUserId: string | null;
}

export function setFbPagesCookie(
  response: NextResponse,
  pages: Array<{ id: string; name: string; token: string }>,
  fbUserId: string | null = null
): NextResponse {
  const payload = JSON.stringify({ pages, fbUserId });
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  const value = Buffer.from(payload).toString("base64") + "." + signature;

  response.cookies.set(FB_PAGES_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}

export function getFbPagesFromCookie(
  request: NextRequest
): Array<{ id: string; name: string; token: string }> | null {
  const data = getFbPagesPayloadFromCookie(request);
  return data?.pages ?? null;
}

export function getFbPagesPayloadFromCookie(
  request: NextRequest
): FbPagesPayload | null {
  const cookie = request.cookies.get(FB_PAGES_COOKIE)?.value;
  if (!cookie) return null;

  const [encodedPayload, signature] = cookie.split(".");
  if (!encodedPayload || !signature) return null;

  const payload = Buffer.from(encodedPayload, "base64").toString("utf-8");
  const expectedSig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      // Legacy cookie format: array of pages, no fbUserId
      return { pages: parsed, fbUserId: null };
    }
    return parsed as FbPagesPayload;
  } catch {
    return null;
  }
}

export function clearFbPagesCookie(response: NextResponse): NextResponse {
  response.cookies.set(FB_PAGES_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
