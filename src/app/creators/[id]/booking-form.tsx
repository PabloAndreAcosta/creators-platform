"use client";

import { useState, useTransition, useEffect } from "react";
import { createBooking, joinQueue } from "@/app/(dashboard)/dashboard/bookings/actions";
import { getAvailability, getTimeSlotsForDate } from "@/app/app/calendar/actions";
import { useToast } from "@/components/ui/toaster";
import { CalendarPlus, X, Users, UserPlus, Minus, Plus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
  event_date?: string | null;
  event_time?: string | null;
  event_location?: string | null;
}

interface TimeSlot {
  id: string;
  start_time: string | null;
  end_time: string | null;
}

// ─── Mini Calendar ───

function MiniCalendar({
  creatorId,
  onSelectDate,
  selectedDate,
}: {
  creatorId: string;
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAvailability(year, month, creatorId).then((res) => {
      setAvailableDates(new Set(res.dates));
      setLoading(false);
    });
  }, [year, month, creatorId]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const firstDay = new Date(year, month - 1, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded p-1 text-[var(--usha-muted)] hover:text-white">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold">{monthNames[month - 1]} {year}</span>
        <button type="button" onClick={nextMonth} className="rounded p-1 text-[var(--usha-muted)] hover:text-white">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-[var(--usha-muted)] mb-1">
        {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isAvailable = availableDates.has(dateStr);
          const isPast = dateStr <= today;
          const isSelected = dateStr === selectedDate;
          const canClick = isAvailable && !isPast;

          return (
            <button
              key={day}
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onSelectDate(dateStr)}
              className={`h-8 w-full rounded-md text-xs font-medium transition ${
                isSelected
                  ? "bg-[var(--usha-gold)] text-black"
                  : canClick
                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    : isPast
                      ? "text-[var(--usha-border)] cursor-not-allowed"
                      : "text-[var(--usha-muted)]/30 cursor-not-allowed"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="mt-2 text-center text-[10px] text-[var(--usha-muted)]">Laddar tillgänglighet...</p>
      )}
      {!loading && availableDates.size === 0 && (
        <p className="mt-2 text-center text-[10px] text-[var(--usha-muted)]">Inga tillgängliga dagar denna månad</p>
      )}
    </div>
  );
}

// ─── Slot Picker ───

function SlotPicker({
  creatorId,
  date,
  onSelectSlot,
  selectedTime,
}: {
  creatorId: string;
  date: string;
  onSelectSlot: (time: string) => void;
  selectedTime: string | null;
}) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [freeTime, setFreeTime] = useState("");

  useEffect(() => {
    setLoading(true);
    getTimeSlotsForDate(date, creatorId).then((res) => {
      setSlots(res.slots);
      setLoading(false);
    });
  }, [date, creatorId]);

  if (loading) {
    return <p className="text-xs text-[var(--usha-muted)]">Laddar tider...</p>;
  }

  const isAllDay = slots.length === 1 && !slots[0].start_time && !slots[0].end_time;
  const hasSlots = slots.length > 0 && !isAllDay;

  return (
    <div>
      <p className="mb-2 text-sm text-[var(--usha-muted)]">
        <Clock size={12} className="mr-1 inline" />
        Välj tid för {new Date(date).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}
      </p>

      {isAllDay && (
        <div>
          <p className="mb-2 text-xs text-green-400">Hela dagen tillgänglig — välj en tid</p>
          <input
            type="time"
            value={freeTime}
            onChange={(e) => {
              setFreeTime(e.target.value);
              onSelectSlot(e.target.value);
            }}
            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
          />
        </div>
      )}

      {hasSlots && (
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => {
            if (!slot.start_time || !slot.end_time) return null;
            const label = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;
            const isSelected = selectedTime === slot.start_time.slice(0, 5);
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSelectSlot(slot.start_time!.slice(0, 5))}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  isSelected
                    ? "bg-[var(--usha-gold)] text-black"
                    : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:bg-[var(--usha-gold)]/10 hover:text-[var(--usha-gold)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {slots.length === 0 && (
        <p className="text-xs text-[var(--usha-muted)]">Inga tider tillgängliga denna dag</p>
      )}
    </div>
  );
}

// ─── Main BookingForm ───

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
  // If listing has a fixed date/time, use it directly (no calendar needed)
  const hasFixedDate = !!listing.event_date;
  const [selectedDate, setSelectedDate] = useState<string | null>(listing.event_date ?? null);
  const [selectedTime, setSelectedTime] = useState<string | null>(
    listing.event_time ? listing.event_time.slice(0, 5) : null
  );
  const { toast } = useToast();

  const showGuestFields = listing.listing_type && ["table_reservation", "spa_treatment", "group_activity"].includes(listing.listing_type);
  const minGuests = listing.min_guests ?? 1;
  const maxGuests = listing.max_guests ?? 99;

  // Build scheduled_at from selected date + time
  const scheduledAt = selectedDate && selectedTime
    ? new Date(`${selectedDate}T${selectedTime}`).toISOString()
    : "";

  if (!isLoggedIn) {
    return (
      <a
        href="/login"
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
        setSelectedDate(null);
        setSelectedTime(null);
      }
    });
  }

  const canPayOnline = hasConnect && listing.price != null && listing.price > 0;

  function handlePaidBooking(formData: FormData) {
    startTransition(async () => {
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
            scheduledAt,
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

  const hasDateTime = hasFixedDate ? true : (selectedDate && selectedTime);

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
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-6 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-[var(--usha-muted)] transition-colors hover:text-white"
            >
              <X size={16} />
            </button>

            <h3 className="mb-1 text-lg font-bold">Boka: {listing.title}</h3>
            <div className="mb-4 flex items-center gap-3 text-sm text-[var(--usha-muted)]">
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
                        <p className="mt-1 text-xs text-[var(--usha-muted)]">{queueState.estimatedTime}</p>
                      )}
                      <p className="mt-3 text-xs text-[var(--usha-muted)]">
                        Du bokas automatiskt när en plats blir ledig.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Fullbokat</p>
                      <p className="mt-1 text-xs text-[var(--usha-muted)]">
                        Alla platser är tagna. Ställ dig i kö så bokas du automatiskt.
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
                <input type="hidden" name="scheduled_at" value={scheduledAt} />

                {/* Fixed date event — show date info instead of calendar */}
                {hasFixedDate ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-3 text-sm">
                      <CalendarPlus size={16} className="text-emerald-400" />
                      <div>
                        <p className="font-semibold">
                          {new Date(listing.event_date! + "T00:00").toLocaleDateString("sv-SE", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                          {listing.event_time && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {listing.event_time.slice(0, 5)}
                            </span>
                          )}
                          {listing.event_location && (
                            <span>{listing.event_location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Step 1: Date picker */}
                    <div>
                      <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                        Välj datum
                      </label>
                      <MiniCalendar
                        creatorId={creatorId}
                        onSelectDate={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                        selectedDate={selectedDate}
                      />
                    </div>

                    {/* Step 2: Time slot picker */}
                    {selectedDate && (
                      <SlotPicker
                        creatorId={creatorId}
                        date={selectedDate}
                        onSelectSlot={setSelectedTime}
                        selectedTime={selectedTime}
                      />
                    )}
                  </>
                )}

                {/* Guest count */}
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

                {/* Attendee details */}
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
                          <UserPlus size={12} /> Lägg till gäst
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
                            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none"
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
                            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none"
                          />
                        </div>
                        <button type="button" onClick={() => setAttendees(attendees.filter((_, j) => j !== i))} className="mt-1 rounded p-1 text-red-400 hover:text-red-300">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <input type="hidden" name="attendees" value={JSON.stringify(attendees.filter(a => a.name))} />
                  </div>
                )}

                {/* Special requests */}
                {showGuestFields && (
                  <div>
                    <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                      Specialönskemål <span className="text-xs">(valfritt)</span>
                    </label>
                    <textarea
                      name="special_requests"
                      rows={2}
                      placeholder="Allergier, önskemål..."
                      className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                    {showGuestFields ? "Övrigt meddelande" : "Meddelande"}{" "}
                    <span className="text-xs">(valfritt)</span>
                  </label>
                  <textarea
                    name="notes"
                    rows={showGuestFields ? 2 : 3}
                    placeholder="Berätta om önskemål eller frågor..."
                    className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none"
                  />
                </div>

                {listing.price != null && listing.price > 0 && (
                  <PromoCodeInput
                    scope="ticket"
                    originalPrice={listing.price}
                    onValidCode={(code) => setPromoCode(code)}
                  />
                )}
                {promoCode && <input type="hidden" name="promo_code" value={promoCode} />}

                {canPayOnline ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isPending || !hasDateTime}
                      onClick={() => {
                        const form = document.getElementById(`booking-form-${listing.id}`) as HTMLFormElement;
                        if (!hasDateTime) { toast.error("Välj datum och tid"); return; }
                        handlePaidBooking(new FormData(form));
                      }}
                      className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isPending ? "Laddar..." : `Boka & betala ${listing.price} SEK`}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || !hasDateTime}
                      className="w-full rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-white disabled:opacity-50"
                    >
                      {isPending ? "Skickar..." : "Skicka förfrågan utan betalning"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isPending || !hasDateTime}
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
