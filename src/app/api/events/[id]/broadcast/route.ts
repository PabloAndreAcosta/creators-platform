import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBroadcast, isValidCtaUrl, type BroadcastRecipient } from "@/lib/email/broadcast";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

// Owner-only: send an email to the event's waitlist (mode 'live'), or a single
// test email to the host (mode 'test'). Writes go via service role; recipients
// are filtered to non-unsubscribed waitlist members and each gets a unique
// unsubscribe link.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const te = await getTranslations("eventErrors");

  let payload: {
    subject?: unknown; body?: unknown; ctaLabel?: unknown; ctaUrl?: unknown; mode?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: te("generic") }, { status: 400 });
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const ctaLabel = typeof payload.ctaLabel === "string" ? payload.ctaLabel.trim() : "";
  const ctaUrl = typeof payload.ctaUrl === "string" ? payload.ctaUrl.trim() : "";
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
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: te("eventNotFound") }, { status: 404 });
  }

  // Test mode: one email to the host, then done. Logged as 'test'.
  if (mode === "test") {
    if (!user.email) {
      return NextResponse.json({ error: te("broadcastNoEmail") }, { status: 400 });
    }
    const result = await sendBroadcast({
      recipients: [{ email: user.email, unsubscribeUrl: `${APP_URL}/waitlist/unsubscribe/forhandsvisning` }],
      subject: `[TEST] ${subject}`,
      body,
      ctaLabel,
      ctaUrl,
    });
    await admin.from("email_broadcasts").insert({
      listing_id: listingId, sender_id: user.id, subject, body,
      cta_label: ctaLabel || null, cta_url: ctaUrl || null,
      audience: "waitlist", recipient_count: result.sent, status: "test",
    });
    return NextResponse.json({ ok: true, mode: "test", ...result });
  }

  // Live mode: active (non-unsubscribed) waitlist members.
  const { data: rows } = await admin
    .from("event_waitlist")
    .select("email, name, unsubscribe_token")
    .eq("listing_id", listingId)
    .is("unsubscribed_at", null);

  const recipients: BroadcastRecipient[] = (rows ?? []).map((r) => ({
    email: r.email,
    name: r.name,
    unsubscribeUrl: `${APP_URL}/waitlist/unsubscribe/${r.unsubscribe_token}`,
  }));

  if (recipients.length === 0) {
    return NextResponse.json({ error: te("noRecipients") }, { status: 400 });
  }

  const result = await sendBroadcast({ recipients, subject, body, ctaLabel, ctaUrl });

  await admin.from("email_broadcasts").insert({
    listing_id: listingId, sender_id: user.id, subject, body,
    cta_label: ctaLabel || null, cta_url: ctaUrl || null,
    audience: "waitlist", recipient_count: result.sent, status: "sent",
  });

  return NextResponse.json({ ok: true, mode: "live", ...result });
}
