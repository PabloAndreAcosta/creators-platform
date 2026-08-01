import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications/create";

// Reads INTERNAL_NOTIFY_SECRET at runtime; a deploy must post-date the env var.
export const runtime = "nodejs";

// Internal, secret-authenticated notification hook. Lets sibling apps that
// aren't part of this codebase — e.g. the Usha Shop (shop.usha.se) — fire an
// owner notification that reuses the platform's in-app + Web Push delivery.
// NOT for public use: guarded by a shared secret header (INTERNAL_NOTIFY_SECRET
// set identically on both apps). No secret configured → always 401.
const OWNER_ID = process.env.NOTIFY_OWNER_ID || "15d852ed-1f33-446f-9bcb-821c2444c84f"; // pablo.acosta@usha.se

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_NOTIFY_SECRET;
  if (!secret || req.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { title?: unknown; message?: unknown; link?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.slice(0, 120) : "";
  const message = typeof body.message === "string" ? body.message.slice(0, 300) : "";
  const link = typeof body.link === "string" ? body.link.slice(0, 300) : undefined;
  if (!title || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // In-app record + Web Push to the owner's devices (best-effort inside).
  await createNotification({ userId: OWNER_ID, type: "shop_sale", title, message, link });
  return NextResponse.json({ ok: true });
}
