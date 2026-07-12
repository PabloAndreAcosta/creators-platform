import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Calendar, Clock, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShareEventButton } from "@/components/share-event-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Din biljett · Usha Platform",
  robots: { index: false, follow: false },
};

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Public, login-free ticket page keyed by the booking UUID (an unguessable
 * capability link, like any e-ticket). Works for guest bookings (customer_id
 * null) AND account bookings. The QR only encodes the verify URL — scanning
 * still requires an authenticated scanner to check anyone in.
 */
export default async function GuestTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUUID(id)) notFound();

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, scheduled_at, guest_name, customer_id, creator_id, listing_id, checked_in_at, ticket_type_name, guest_count")
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: listing }, { data: creator }] = await Promise.all([
    admin
      .from("listings")
      .select("title, event_date, event_time, event_location")
      .eq("id", booking.listing_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", booking.creator_id)
      .maybeSingle(),
  ]);

  let attendee: string | null = booking.guest_name;
  if (!attendee && booking.customer_id) {
    const { data: c } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", booking.customer_id)
      .maybeSingle();
    attendee = c?.full_name ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const code = `USH-${booking.id.slice(0, 8).toUpperCase()}`;
  const verifyUrl = `${appUrl}/api/tickets/verify?code=${code}&id=${booking.id}`;
  const qrOpts = {
    width: 240,
    margin: 2,
    errorCorrectionLevel: "M" as const,
    color: { dark: "#000000", light: "#ffffff" },
  };
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, qrOpts);

  // Multi-ticket order: one QR per attendee, each individually scannable.
  const isMulti = (booking.guest_count ?? 1) > 1;
  const attendeeQrs: { id: string; label: string; checkedIn: boolean; qr: string }[] = [];
  if (isMulti) {
    const { data: attRows } = await admin
      .from("ticket_attendees")
      .select("id, idx, name, checked_in_at")
      .eq("booking_id", booking.id)
      .order("idx", { ascending: true });
    for (const a of attRows ?? []) {
      const url = `${appUrl}/api/tickets/verify?code=${code}&id=${booking.id}&att=${a.id}`;
      attendeeQrs.push({
        id: a.id,
        label: a.name || `Gäst ${a.idx} av ${booking.guest_count}`,
        checkedIn: !!a.checked_in_at,
        qr: await QRCode.toDataURL(url, qrOpts),
      });
    }
  }

  const scheduled = new Date(booking.scheduled_at);
  const dateLabel = listing?.event_date
    ? new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : scheduled.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = listing?.event_time
    ? listing.event_time.slice(0, 5)
    : scheduled.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

  const canceled = booking.status === "canceled";
  const used = booking.status === "completed" || !!booking.checked_in_at;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--usha-black)] px-4 py-10 text-[var(--usha-white)]">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
        <div className="border-b border-[var(--usha-border)] px-6 py-4 text-center">
          <span className="text-lg font-bold text-[var(--usha-gold)]">Usha Platform</span>
        </div>

        <div className="space-y-4 p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold">{listing?.title ?? "Event"}</h1>
            {booking.ticket_type_name && (
              <p className="mt-1 inline-block rounded-full bg-[var(--usha-gold)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
                {booking.ticket_type_name}
              </p>
            )}
            {attendee && (
              <p className="mt-1 text-sm text-[var(--usha-muted)]">{attendee}</p>
            )}
          </div>

          {/* QR or status */}
          {canceled ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-red-500/10 p-6 text-center">
              <XCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm font-medium text-red-400">Bokningen är avbokad</p>
            </div>
          ) : isMulti ? (
            <div className="flex flex-col items-center gap-5">
              <p className="text-xs text-[var(--usha-muted)]">
                {booking.guest_count} biljetter — en QR per gäst
              </p>
              {attendeeQrs.map((a) => (
                <div key={a.id} className="flex flex-col items-center gap-2">
                  <p className="text-sm font-medium">{a.label}</p>
                  {a.checkedIn && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Incheckad
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.qr}
                    alt={`QR-kod ${a.label}`}
                    width={200}
                    height={200}
                    className={`rounded-xl bg-white p-3 ${a.checkedIn ? "opacity-40" : ""}`}
                  />
                </div>
              ))}
              <p className="text-xs tracking-wider text-[var(--usha-muted)]">{code}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {used && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Incheckad
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Biljett QR-kod"
                width={240}
                height={240}
                className={`rounded-xl bg-white p-3 ${used ? "opacity-40" : ""}`}
              />
              <p className="text-xs tracking-wider text-[var(--usha-muted)]">{code}</p>
            </div>
          )}

          {/* Details */}
          <div className="space-y-2 rounded-xl bg-[var(--usha-black)]/40 p-4 text-sm">
            <div className="flex items-center gap-2 text-[var(--usha-muted)]">
              <Calendar size={14} className="text-[var(--usha-gold)]" />
              <span className="text-[var(--usha-white)]">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--usha-muted)]">
              <Clock size={14} className="text-[var(--usha-gold)]" />
              <span className="text-[var(--usha-white)]">{timeLabel}</span>
            </div>
            {listing?.event_location && (
              <div className="flex items-center gap-2 text-[var(--usha-muted)]">
                <MapPin size={14} className="text-[var(--usha-gold)]" />
                <span className="text-[var(--usha-white)]">{listing.event_location}</span>
              </div>
            )}
            {creator?.full_name && (
              <p className="pt-1 text-xs text-[var(--usha-muted)]">Arrangör: {creator.full_name}</p>
            )}
          </div>

          {!canceled && !used && (
            <p className="text-center text-xs text-[var(--usha-muted)]">
              Visa den här QR-koden vid entrén.
            </p>
          )}

          {!canceled && (
            <ShareEventButton
              url={`${appUrl}/listing/${booking.listing_id}`}
              title={listing?.title ?? "Event"}
              text={`Jag ska på ${listing?.title ?? "detta event"} — häng med!`}
              label="Bjud in vänner"
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            />
          )}
        </div>
      </div>
    </main>
  );
}
