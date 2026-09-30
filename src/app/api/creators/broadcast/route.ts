import { NextRequest, NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBroadcast, isValidCtaUrl, type BroadcastRecipient } from "@/lib/email/broadcast";
import { getEmailIntl } from "@/lib/email/i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";
import { mottagareAvFoljare } from "@/lib/email/follower-audience";
import { activeEmailFollowers } from "@/lib/follows/email-follow";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

/**
 * Utskick till kreatörens EGNA följare.
 *
 * Fanns bara per evenemang tidigare: en kreatör kunde skriva till dem som
 * ställt sig i kö till en viss kväll, men inte till dem som följer hen. Det är
 * bakvänt — följaren har sagt ja till avsändaren, väntelistan bara till en
 * kväll.
 *
 * Mottagarna är bekräftade mejlföljare. Kontoföljare får inget mejl; se
 * lib/email/follower-audience.ts för varför.
 */
export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import("@/lib/rate-limit");
  // Ett utskick per minut räcker gott och hindrar att ett misstag upprepas
  // innan någon hunnit reagera.
  const rl = rateLimit(getRateLimitKey(req, "creator-broadcast"), 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const te = await getTranslations("eventErrors");

  let payload: { subject?: unknown; body?: unknown; ctaLabel?: unknown; ctaUrl?: unknown; mode?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: te("generic") }, { status: 400 });
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const ctaLabel = typeof payload.ctaLabel === "string" ? payload.ctaLabel.trim() : "";
  const ctaUrl = typeof payload.ctaUrl === "string" ? payload.ctaUrl.trim() : "";
  // Standard är test. Ett live-utskick ska kräva ett aktivt val, inte vara
  // det som händer när fältet glöms bort.
  const mode = payload.mode === "live" ? "live" : "test";

  if (!subject || subject.length > 200) {
    return NextResponse.json({ error: te("subjectRequired") }, { status: 400 });
  }
  if (!body || body.length > 10000) {
    return NextResponse.json({ error: te("messageRequired") }, { status: 400 });
  }
  if (ctaUrl && !isValidCtaUrl(ctaUrl)) {
    return NextResponse.json({ error: te("ctaUrlInvalid") }, { status: 400 });
  }

  const admin = createAdminClient();

  if (mode === "test") {
    if (!user.email) {
      return NextResponse.json({ error: te("broadcastNoEmail") }, { status: 400 });
    }
    const { t: tEmail } = await getEmailIntl(await resolveRecipientLocale({ preferred: await getLocale() }));
    const result = await sendBroadcast({
      recipients: [{ email: user.email, unsubscribeUrl: `${APP_URL}/waitlist/unsubscribe/forhandsvisning` }],
      subject: `[TEST] ${subject}`,
      body,
      ctaLabel,
      ctaUrl,
      t: tEmail,
    });
    await admin.from("email_broadcasts").insert({
      listing_id: null,
      creator_id: user.id,
      sender_id: user.id,
      subject,
      body,
      cta_label: ctaLabel || null,
      cta_url: ctaUrl || null,
      audience: "followers",
      recipient_count: result.sent,
      status: "test",
    });
    return NextResponse.json({ ok: true, mode: "test", ...result });
  }

  // Samma hämtning som notiserna använder — bekräftade och inte avslutade.
  // Att skriva en egen fråga hade betytt två definitioner av "aktiv följare"
  // som kan glida isär.
  const rows = await activeEmailFollowers(admin, user.id);
  const mottagare = mottagareAvFoljare(rows);
  if (mottagare.length === 0) {
    return NextResponse.json({ error: te("noRecipients") }, { status: 400 });
  }

  // Följaren valde språk när hen skrev upp sig. Ett utskick på fel språk är
  // inte bara obekvämt, det ser ut som spam.
  type Locale = Awaited<ReturnType<typeof resolveRecipientLocale>>;
  const perLocale = new Map<Locale, BroadcastRecipient[]>();
  for (const m of mottagare) {
    const loc = await resolveRecipientLocale({ preferred: m.locale });
    const list = perLocale.get(loc) ?? [];
    list.push({ email: m.email, unsubscribeUrl: `${APP_URL}/folj/avsluta/${m.unsubscribeToken}` });
    perLocale.set(loc, list);
  }

  let sent = 0;
  let failed = 0;
  for (const [loc, recipients] of perLocale) {
    const { t: tEmail } = await getEmailIntl(loc);
    const result = await sendBroadcast({ recipients, subject, body, ctaLabel, ctaUrl, t: tEmail });
    sent += result.sent;
    failed += result.failed ?? 0;
  }

  await admin.from("email_broadcasts").insert({
    listing_id: null,
    creator_id: user.id,
    sender_id: user.id,
    subject,
    body,
    cta_label: ctaLabel || null,
    cta_url: ctaUrl || null,
    audience: "followers",
    recipient_count: sent,
    status: "sent",
  });

  return NextResponse.json({ ok: true, mode: "live", sent, failed });
}
