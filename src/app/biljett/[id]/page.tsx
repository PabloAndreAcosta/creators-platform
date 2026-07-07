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
    .select("id, status, scheduled_at, guest_name, customer_id, creator_id, listing_id, checked_in_at")
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
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 240,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

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
