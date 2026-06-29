import { NextRequest, NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, normalizeEmail, cleanName } from "@/lib/waitlist";
import { getResend, getFromEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/email/broadcast";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

// Confirmation email on a fresh signup, in the event's language (or the
// visitor's). Includes a save-the-date and an unsubscribe link. Non-blocking.
async function sendWaitlistConfirmation(opts: {
  to: string;
  token: string;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  contentLanguage: string | null;
}) {
  const lang =
    opts.contentLanguage === "en" || opts.contentLanguage === "sv"
      ? opts.contentLanguage
      : await getLocale();
  const t = await getTranslations({ locale: lang, namespace: "eventEmails" });
  const title = escapeHtml(opts.title);
  const unsubUrl = `${APP_URL}/waitlist/unsubscribe/${opts.token}`;

  let dateBlock = "";
  if (opts.eventDate) {
    const d = new Date(`${opts.eventDate}T${opts.eventTime || "12:00"}:00+02:00`);
    if (!isNaN(d.getTime())) {
      const dateStr = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "sv-SE", {
        weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Stockholm",
      }).format(d);
      dateBlock = `<p style="margin:16px 0;"><strong>${escapeHtml(t("saveTheDate", { date: dateStr }))}</strong></p>`;
    }
  }

  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="color:#c8a445;">${escapeHtml(t("confirmHeading"))}</h2>
  <p style="font-size:15px;line-height:1.6;">${escapeHtml(t("confirmBody", { title }))}</p>
  ${dateBlock}
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px;">
  <p style="color:#999;font-size:12px;line-height:1.5;">
    ${escapeHtml(t("confirmFooter"))}<br>
    <a href="${escapeHtml(unsubUrl)}" style="color:#999;">${escapeHtml(t("confirmUnsub"))}</a>
  </p>
</div>`;

  await getResend().emails.send({
    from: getFromEmail(),
    to: opts.to,
    subject: t("confirmSubject", { title: opts.title }),
    html,
  });
}

// Public, unauthenticated: a guest joins an event's waitlist (name + email).
// Writes via service role (never anon) so the table stays insert-locked at RLS.
// Idempotent: re-submitting the same email for the same event is a no-op "ok".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const te = await getTranslations("eventErrors");

  let body: { name?: unknown; email?: unknown; source?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: te("generic") }, { status: 400 });
  }

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: te("invalidEmail") }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: te("consentRequired") }, { status: 400 });
  }

  const admin = createAdminClient();

  // The event must exist and be active to accept signups.
  const { data: listing } = await admin
    .from("listings")
    .select("id, title, event_date, event_time, content_language")
    .eq("id", listingId)
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ error: te("eventNotFound") }, { status: 404 });
  }

  const email = normalizeEmail(body.email);
  const name = cleanName(body.name);
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "event_page";

  const { data: inserted, error } = await admin
    .from("event_waitlist")
    .insert({ listing_id: listingId, email, name, source })
    .select("unsubscribe_token")
    .maybeSingle();

  // 23505 = unique_violation → already on the list. Treat as success (idempotent).
  if (error && error.code !== "23505") {
    console.error("waitlist insert failed:", error);
    return NextResponse.json({ error: te("generic") }, { status: 500 });
  }

  // Fresh signup → send confirmation (non-blocking; signup succeeds regardless).
  if (!error && inserted?.unsubscribe_token) {
    sendWaitlistConfirmation({
      to: email,
      token: inserted.unsubscribe_token,
      title: listing.title,
      eventDate: listing.event_date,
      eventTime: listing.event_time,
      contentLanguage: listing.content_language,
    }).catch((e) => console.error("waitlist confirmation email failed:", e));
  }

  return NextResponse.json({ ok: true, alreadyOn: error?.code === "23505" });
}
