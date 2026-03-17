"use client";

import { useState, useTransition } from "react";
import { createBooking, joinQueue } from "@/app/(dashboard)/dashboard/bookings/actions";
import { useToast } from "@/components/ui/toaster";
import { CalendarPlus, X, Users } from "lucide-react";
import { PromoCodeInput } from "@/components/promo-code-input";

interface Listing {
  id: string;
  title: string;
  price: number | null;
  duration_minutes: number | null;
}

export default function BookingForm({
  listing,
  creatorId,
  isLoggedIn,
}: {
  listing: Listing;
  creatorId: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [queueState, setQueueState] = useState<{
    isFull: boolean;
    position?: number;
    estimatedTime?: string;
  }>({ isFull: false });
  const [promoCode, setPromoCode] = useState("");
  const { toast } = useToast();

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
              <form action={handleSubmit} className="space-y-4">
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

                <div>
                  <label
                    htmlFor={`notes-${listing.id}`}
                    className="mb-1.5 block text-sm text-[var(--usha-muted)]"
                  >
                    Meddelande <span className="text-xs">(valfritt)</span>
                  </label>
                  <textarea
                    id={`notes-${listing.id}`}
                    name="notes"
                    rows={3}
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

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Skickar..." : "Skicka bokningsförfrågan"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
