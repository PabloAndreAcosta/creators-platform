import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications/create";
import { sendAgreementEmail } from "@/lib/email/send-agreement";
import {
  BODY_MAX, TITLE_MAX, canSign, canWriteAgreements, contentHash, isParty, loadParties, logEvent, signatureName,
  type AgreementRow,
} from "@/lib/agreements/model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientInfo(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;
  return { ip, ua };
}

async function load(id: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("agreements").select("*").eq("id", id).maybeSingle();
  const a = data as AgreementRow | null;
  if (!a || !isParty(a, userId)) return { admin, a: null };
  return { admin, a };
}

/** PATCH — ändra titel/text. Bara utkast, bara skaparen. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, a } = await load(id, user.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (a.status !== "draft") return NextResponse.json({ error: "notDraft" }, { status: 409 });

  let payload: { title?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const title = String(payload.title ?? a.title).trim();
  const body = String(payload.body ?? a.body).trim();
  if (!title || title.length > TITLE_MAX) return NextResponse.json({ error: "titleInvalid" }, { status: 400 });
  if (!body || body.length > BODY_MAX) return NextResponse.json({ error: "invalidBody" }, { status: 400 });

  await admin.from("agreements").update({ title, body, updated_at: new Date().toISOString() }).eq("id", id);
  await logEvent(admin, id, user.id, "edited");
  return NextResponse.json({ ok: true });
}

/**
 * POST — ett steg i flödet: { action: "send" | "sign" | "decline" | "withdraw", reason? }
 * - send: skaparen signerar och skickar (utkast → skickat). Kräver Premium + BankID.
 * - sign: motparten signerar (skickat → signerat). Kräver BankID.
 * - decline: motparten avböjer med valfri anledning.
 * - withdraw: skaparen drar tillbaka ett skickat avtal.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(getRateLimitKey(req, "agreements-action"), 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { action?: string; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const action = String(payload.action ?? "");

  const { admin, a } = await load(id, user.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { creator, counterparty } = await loadParties(admin, a);
  const me = user.id === a.created_by ? creator : counterparty;
  const other = user.id === a.created_by ? counterparty : creator;
  const { ip, ua } = clientInfo(req);
  const now = new Date().toISOString();
  const link = `/app/avtal/${a.id}`;

  if (action === "send") {
    if (a.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (a.status !== "draft") return NextResponse.json({ error: "notDraft" }, { status: 409 });
    if (!(await canWriteAgreements(admin, user.id))) return NextResponse.json({ error: "premiumRequired" }, { status: 403 });
    if (!canSign(me)) return NextResponse.json({ error: "bankidRequired" }, { status: 403 });
    const hash = contentHash(a.title, a.body);
    await admin
      .from("agreements")
      .update({
        status: "sent", content_hash: hash, sent_at: now,
        creator_signed_at: now, creator_sign_name: signatureName(me), creator_sign_ip: ip, creator_sign_ua: ua,
        updated_at: now,
      })
      .eq("id", id);
    await logEvent(admin, id, user.id, "sent", { hash, ip });
    await createNotification({
      userId: a.counterparty_id, type: "agreement_sent", link,
      titleKey: "agreementSentTitle", bodyKey: "agreementSentMsg",
      params: { name: signatureName(me) || "…", title: a.title },
    });
    if (other?.email) void sendAgreementEmail({ kind: "sent", to: other.email, recipientId: other.id, recipientName: other.full_name ?? "", otherName: signatureName(me), title: a.title, agreementId: a.id });
    return NextResponse.json({ ok: true, status: "sent" });
  }

  if (action === "sign") {
    if (a.counterparty_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (a.status !== "sent") return NextResponse.json({ error: "notSent" }, { status: 409 });
    if (!canSign(me)) return NextResponse.json({ error: "bankidRequired" }, { status: 403 });
    // Texten får inte ha ändrats sedan den skickades.
    if (contentHash(a.title, a.body) !== a.content_hash) return NextResponse.json({ error: "contentChanged" }, { status: 409 });
    await admin
      .from("agreements")
      .update({
        status: "signed",
        counterparty_signed_at: now, counterparty_sign_name: signatureName(me), counterparty_sign_ip: ip, counterparty_sign_ua: ua,
        updated_at: now,
      })
      .eq("id", id);
    await logEvent(admin, id, user.id, "signed", { hash: a.content_hash, ip });
    await createNotification({
      userId: a.created_by, type: "agreement_signed", link,
      titleKey: "agreementSignedTitle", bodyKey: "agreementSignedMsg",
      params: { name: signatureName(me) || "…", title: a.title },
    });
    // Båda får en kopia när avtalet är klart.
    if (other?.email) void sendAgreementEmail({ kind: "signed", to: other.email, recipientId: other.id, recipientName: other.full_name ?? "", otherName: signatureName(me), title: a.title, agreementId: a.id });
    if (me?.email) void sendAgreementEmail({ kind: "signed", to: me.email, recipientId: me.id, recipientName: me.full_name ?? "", otherName: signatureName(other), title: a.title, agreementId: a.id });
    return NextResponse.json({ ok: true, status: "signed" });
  }

  if (action === "decline") {
    if (a.counterparty_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (a.status !== "sent") return NextResponse.json({ error: "notSent" }, { status: 409 });
    const reason = String(payload.reason ?? "").trim().slice(0, 500) || null;
    await admin.from("agreements").update({ status: "declined", declined_at: now, decline_reason: reason, updated_at: now }).eq("id", id);
    await logEvent(admin, id, user.id, "declined", { reason });
    await createNotification({
      userId: a.created_by, type: "agreement_declined", link,
      titleKey: "agreementDeclinedTitle", bodyKey: "agreementDeclinedMsg",
      params: { name: signatureName(me) || other?.full_name || "…", title: a.title },
    });
    if (other?.email) void sendAgreementEmail({ kind: "declined", to: other.email, recipientId: other.id, recipientName: other.full_name ?? "", otherName: signatureName(me) || "", title: a.title, agreementId: a.id, reason });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  if (action === "withdraw") {
    if (a.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (a.status !== "sent" && a.status !== "draft") return NextResponse.json({ error: "notOpen" }, { status: 409 });
    await admin.from("agreements").update({ status: "withdrawn", withdrawn_at: now, updated_at: now }).eq("id", id);
    await logEvent(admin, id, user.id, "withdrawn");
    if (a.status === "sent") {
      await createNotification({
        userId: a.counterparty_id, type: "agreement_withdrawn", link,
        titleKey: "agreementWithdrawnTitle", bodyKey: "agreementWithdrawnMsg",
        params: { name: signatureName(me) || "…", title: a.title },
      });
    }
    return NextResponse.json({ ok: true, status: "withdrawn" });
  }

  return NextResponse.json({ error: "unknownAction" }, { status: 400 });
}
