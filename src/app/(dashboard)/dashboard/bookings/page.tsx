import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import {
  ConfirmButton,
  CancelButton,
  CompleteButton,
} from "./booking-actions";

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  pending: { text: "Väntande", className: "bg-yellow-500/10 text-yellow-400" },
  confirmed: { text: "Bekräftad", className: "bg-green-500/10 text-green-400" },
  completed: { text: "Slutförd", className: "bg-blue-500/10 text-blue-400" },
  canceled: { text: "Avbokad", className: "bg-red-500/10 text-red-400" },
};

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Incoming bookings (as creator)
  const { data: incoming } = await supabase
    .from("bookings")
    .select(
      "id, status, scheduled_at, notes, created_at, listing_id, customer_id"
    )
    .eq("creator_id", user.id)
    .order("scheduled_at", { ascending: true });

  // Outgoing bookings (as customer)
  const { data: outgoing } = await supabase
    .from("bookings")
    .select(
      "id, status, scheduled_at, notes, created_at, listing_id, creator_id"
    )
    .eq("customer_id", user.id)
    .order("scheduled_at", { ascending: true });

  // Gather related listing and profile data
  const listingIds = Array.from(
    new Set([
      ...(incoming?.map((b) => b.listing_id) ?? []),
      ...(outgoing?.map((b) => b.listing_id) ?? []),
    ])
  );
  const profileIds = Array.from(
    new Set([
      ...(incoming?.map((b) => b.customer_id) ?? []),
      ...(outgoing?.map((b) => b.creator_id) ?? []),
    ])
  );

  const [{ data: listings }, { data: profiles }] = await Promise.all([
    listingIds.length > 0
      ? supabase
          .from("listings")
          .select("id, title")
          .in("id", listingIds)
      : { data: [] as { id: string; title: string }[] },
    profileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] },
  ]);

  const listingMap = Object.fromEntries(
    (listings ?? []).map((l) => [l.id, l.title])
  );
  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name || "Anonym"])
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const hasIncoming = incoming && incoming.length > 0;
  const hasOutgoing = outgoing && outgoing.length > 0;

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Bokningar</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Hantera dina inkommande och utgående bokningar.
        </p>
      </div>

      {/* Incoming bookings (as creator) */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Calendar size={18} className="text-[var(--usha-gold)]" />
          Inkommande bokningar
        </h2>
        {!hasIncoming ? (
          <p className="text-sm text-[var(--usha-muted)]">
            Inga inkommande bokningar.
          </p>
        ) : (
          <div className="space-y-3">
            {incoming.map((booking) => {
              const status = STATUS_LABELS[booking.status] ?? STATUS_LABELS.pending;
              return (
                <div
                  key={booking.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {listingMap[booking.listing_id] || "Tjänst"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
                      <span>Kund: {profileMap[booking.customer_id] || "Anonym"}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(booking.scheduled_at)}
                      </span>
                    </div>
                    {booking.notes && (
                      <p className="mt-2 text-sm text-[var(--usha-muted)] italic">
                        &ldquo;{booking.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {booking.status === "pending" && (
                      <>
                        <ConfirmButton bookingId={booking.id} />
                        <CancelButton bookingId={booking.id} />
                      </>
                    )}
                    {booking.status === "confirmed" && (
                      <>
                        <CompleteButton bookingId={booking.id} />
                        <CancelButton bookingId={booking.id} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outgoing bookings (as customer) */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Calendar size={18} className="text-[var(--usha-accent)]" />
          Mina bokningar
        </h2>
        {!hasOutgoing ? (
          <p className="text-sm text-[var(--usha-muted)]">
            Du har inte bokat någon tjänst ännu.{" "}
            <Link
              href="/marketplace"
              className="text-[var(--usha-gold)] hover:underline"
            >
              Utforska marketplace
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {outgoing.map((booking) => {
              const status = STATUS_LABELS[booking.status] ?? STATUS_LABELS.pending;
              return (
                <div
                  key={booking.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {listingMap[booking.listing_id] || "Tjänst"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
                      <span>Creator: {profileMap[booking.creator_id] || "Anonym"}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(booking.scheduled_at)}
                      </span>
                    </div>
                    {booking.notes && (
                      <p className="mt-2 text-sm text-[var(--usha-muted)] italic">
                        &ldquo;{booking.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(booking.status === "pending" ||
                      booking.status === "confirmed") && (
                      <CancelButton bookingId={booking.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
