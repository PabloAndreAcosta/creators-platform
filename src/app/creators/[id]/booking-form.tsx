"use client";

import { useState, useTransition } from "react";
import { createBooking, joinQueue } from "@/app/(dashboard)/dashboard/bookings/actions";
import { useToast } from "@/components/ui/toaster";
import { CalendarPlus, X, Users, UserPlus, Minus, Plus } from "lucide-react";
import { PromoCodeInput } from "@/components/promo-code-input";
import type { ListingType, ExperienceDetails } from "@/types/database";

interface Listing {
  id: string;
  title: string;
  price: number | null;
  duration_minutes: number | null;
  listing_type?: ListingType;
  min_guests?: number | null;
  max_guests?: number | null;
  experience_details?: ExperienceDetails | null;
}

export default function BookingForm({
  listing,
  creatorId,
  isLoggedIn,
  hasConnect,
}: {
  listing: Listing;
  creatorId: string;
  isLoggedIn: boolean;
  hasConnect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [queueState, setQueueState] = useState<{
    isFull: boolean;
    position?: number;
    estimatedTime?: string;
  }>({ isFull: false });
  const [promoCode, setPromoCode] = useState("");
  const [guestCount, setGuestCount] = useState(listing.min_guests != null ? listing.min_guests : 1);
  const [attendees, setAttendees] = useState<{ name: string; dietary: string }[]>([]);
  const { toast } = useToast();

  const showGuestFields = listing.listing_type && ["table_reservation", "spa_treatment", "group_activity"].includes(listing.listing_type);
  const minGuests = listing.min_guests ?? 1;
  const maxGuests = listing.max_guests ?? 99;

  if (!isLoggedIn) {
    return (
      <a
        href={`/login`}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <CalendarPlus size={13} />
        Logga in för att boka
      </a>
    );
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createBooking(formData);
      if (result.error) {
        if (result.error === "Denna tjänst är fullbokad.") {
          setQueueState({ isFull: true });
        } else {
          toast.error("Kunde inte skicka bokning", result.error);
        }
      } else {
        toast.success("Bokning skickad", "Inväntar bekräftelse från skaparen.");
        setOpen(false);
      }
    });
  }

  const canPayOnline = hasConnect && listing.price != null && listing.price > 0;

  function handlePaidBooking(formData: FormData) {
    startTransition(async () => {
      const scheduledAt = formData.get("scheduled_at") as string;
      const notes = (formData.get("notes") as string)?.trim() || "";
      const guestCountVal = formData.get("guest_count") as string;
      const specialReqs = (formData.get("special_requests") as string)?.trim() || "";
      const attendeesVal = (formData.get("attendees") as string) || "[]";

      try {
        const res = await fetch("/api/stripe/booking-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            creatorId,
            scheduledAt: new Date(scheduledAt).toISOString(),
            notes,
            guestCount: guestCountVal ? parseInt(guestCountVal, 10) : 1,
            specialRequests: specialReqs,
            attendees: (() => { try { return JSON.parse(attendeesVal); } catch { return []; } })(),
            promoCode: promoCode || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error("Kunde inte starta betalning", data.error || "Okänt fel");
          return;
        }
        if (data.url) {
          window.location.href = data.url;
        }
      } catch {
        toast.error("Kunde inte starta betalning", "Försök igen.");
      }
    });
  }

  function handleJoinQueue() {
    startTransition(async () => {
      const result = await joinQueue(listing.id);
      if (result.error) {
        toast.error("Kunde inte gå med i kön", result.error);
      } else {
        setQueueState({
          isFull: true,
          position: result.queuePosition,
          estimatedTime: result.estimatedTime,
        });
        toast.success(
          "Du är i kön!",
          `Plats ${result.queuePosition}. Du bokas automatiskt när en plats blir ledig.`
        );
      }
    });
  }

  // Min date: tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <CalendarPlus size={13} />
        Boka
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-6 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-[var(--usha-muted)] transition-colors hover:text-white"
            >
              <X size={16} />
            </button>

            <h3 className="mb-1 text-lg font-bold">Boka: {listing.title}</h3>
            <div className="mb-6 flex items-center gap-3 text-sm text-[var(--usha-muted)]">
              {listing.price != null && (
                <span className="font-semibold text-[var(--usha-gold)]">
                  {listing.price} SEK
                </span>
              )}
              {listing.duration_minutes != null && (
                <span>{listing.duration_minutes} min</span>
              )}
            </div>

            {queueState.isFull ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-[var(--usha-gold)]/5 p-4 text-center">
                  <Users size={28} className="mx-auto mb-2 text-[var(--usha-gold)]" />
                  {queueState.position ? (
                    <>
                      <p className="text-sm font-semibold">Du är i kön!</p>
                      <p className="mt-1 text-2xl font-bold text-[var(--usha-gold)]">
                        Plats {queueState.position}
                      </p>
                      {queueState.estimatedTime && (
                        <p className="mt-1 text-xs text-[var(--usha-muted)]">
                          {queueState.estimatedTime}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-[var(--usha-muted)]">
                        Du bokas automatiskt när en plats blir ledig.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Fullbokat</p>
                      <p className="mt-1 text-xs text-[var(--usha-muted)]">
                        Alla platser är tagna. Ställ dig i kö så bokas du automatiskt när en plats blir ledig.
                      </p>
                    </>
                  )}
                </div>
                {!queueState.position && (
                  <button
                    type="button"
                    onClick={handleJoinQueue}
                    disabled={isPending}
                    className="w-full rounded-xl border border-[var(--usha-gold)] py-3 text-sm font-bold text-[var(--usha-gold)] transition hover:bg-[var(--usha-gold)]/10 disabled:opacity-50"
                  >
                    {isPending ? "Ansluter..." : "Ställ dig i kön"}
                  </button>
                )}
              </div>
            ) : (
              <form id={`booking-form-${listing.id}`} action={handleSubmit} className="space-y-4">
                <input type="hidden" name="listing_id" value={listing.id} />
                <input type="hidden" name="creator_id" value={creatorId} />

                <div>
                  <label
                    htmlFor={`date-${listing.id}`}
                    className="mb-1.5 block text-sm text-[var(--usha-muted)]"
                  >
                    Datum och tid
                  </label>
                  <input
                    id={`date-${listing.id}`}
                    name="scheduled_at"
                    type="datetime-local"
                    required
                    min={minDate}
                    className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
                  />
                </div>

                {/* Guest count (experience types) */}
                {showGuestFields && (
                  <div>
                    <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                      Antal gäster
                      {listing.max_guests && (
                        <span className="text-xs ml-1">({minGuests}–{maxGuests})</span>
                      )}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(minGuests, guestCount - 1);
                          setGuestCount(next);
                          if (next < attendees.length) setAttendees(attendees.slice(0, next));
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--usha-border)] text-[var(--usha-muted)] transition hover:text-white disabled:opacity-30"
                        disabled={guestCount <= minGuests}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[2rem] text-center text-lg font-bold">{guestCount}</span>
                      <button
                        type="button"
                        onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--usha-border)] text-[var(--usha-muted)] transition hover:text-white disabled:opacity-30"
                        disabled={guestCount >= maxGuests}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <input type="hidden" name="guest_count" value={guestCount} />
                  </div>
                )}

                {/* Attendee details (when > 1 guest) */}
                {showGuestFields && guestCount > 1 && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-sm text-[var(--usha-muted)]">
                        Gästuppgifter <span className="text-xs">(valfritt)</span>
                      </label>
                      {attendees.length < guestCount && (
                        <button
                          type="button"
                          onClick={() => setAttendees([...attendees, { name: "", dietary: "" }])}
                          className="flex items-center gap-1 text-xs text-[var(--usha-gold)] hover:underline"
                        >
                          <UserPlus size={12} />
                          Lägg till gäst
                        </button>
                      )}
                    </div>
                    {attendees.map((att, i) => (
                      <div key={i} className="mb-2 flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            placeholder={`Gäst ${i + 1} namn`}
                            value={att.name}
                            onChange={(e) => {
                              const next = [...attendees];
                              next[i] = { ...next[i], name: e.target.value };
                              setAttendees(next);
                            }}
                            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40"
                          />
                          <input
                            type="text"
                            placeholder="Allergier / specialkost"
                            value={att.dietary}
                            onChange={(e) => {
                              const next = [...attendees];
                              next[i] = { ...next[i], dietary: e.target.value };
                              setAttendees(next);
                            }}
                            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttendees(attendees.filter((_, j) => j !== i))}
                          className="mt-1 rounded p-1 text-red-400 hover:text-red-300"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <input type="hidden" name="attendees" value={JSON.stringify(attendees.filter(a => a.name))} />
                  </div>
                )}

                {/* Special requests (experience types) */}
                {showGuestFields && (
                  <div>
                    <label
                      htmlFor={`special-${listing.id}`}
                      className="mb-1.5 block text-sm text-[var(--usha-muted)]"
                    >
                      Specialönskemål <span className="text-xs">(valfritt)</span>
                    </label>
                    <textarea
                      id={`special-${listing.id}`}
                      name="special_requests"
                      rows={2}
                      placeholder={
                        listing.listing_type === "table_reservation"
                          ? "Allergier, högtidsfirande, önskemål om bord..."
                          : listing.listing_type === "spa_treatment"
                          ? "Hälsovillkor, önskemål om behandling..."
                          : "Specialönskemål för gruppen..."
                      }
                      className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor={`notes-${listing.id}`}
                    className="mb-1.5 block text-sm text-[var(--usha-muted)]"
                  >
                    {showGuestFields ? "Övrigt meddelande" : "Meddelande"}{" "}
                    <span className="text-xs">(valfritt)</span>
                  </label>
                  <textarea
                    id={`notes-${listing.id}`}
                    name="notes"
                    rows={showGuestFields ? 2 : 3}
                    placeholder="Berätta om önskemål eller frågor..."
                    className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
                  />
                </div>

                {listing.price != null && listing.price > 0 && (
                  <PromoCodeInput
                    scope="ticket"
                    originalPrice={listing.price}
                    onValidCode={(code) => setPromoCode(code)}
                  />
                )}
                {promoCode && (
                  <input type="hidden" name="promo_code" value={promoCode} />
                )}

                {canPayOnline ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const form = document.getElementById(`booking-form-${listing.id}`) as HTMLFormElement;
                        if (!form.checkValidity()) { form.reportValidity(); return; }
                        handlePaidBooking(new FormData(form));
                      }}
                      className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isPending ? "Laddar..." : `Boka & betala ${listing.price} SEK`}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-white disabled:opacity-50"
                    >
                      {isPending ? "Skickar..." : "Skicka förfrågan utan betalning"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isPending ? "Skickar..." : "Skicka bokningsförfrågan"}
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
