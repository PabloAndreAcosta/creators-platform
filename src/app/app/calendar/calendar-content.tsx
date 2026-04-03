"use client";

import { useState, useTransition, useEffect } from "react";
import { ChevronLeft, ChevronRight, MapPin, Clock, Calendar, Check, Plus, Trash2, Loader2 } from "lucide-react";
import { useRole } from "@/components/mobile/role-context";
import { toggleAvailability, getAvailability, addTimeSlot, removeTimeSlot } from "./actions";

const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

const EVENT_COLORS = [
  "border-l-[var(--usha-gold)]",
  "border-l-[var(--usha-accent)]",
  "border-l-emerald-400",
  "border-l-blue-400",
  "border-l-purple-400",
  "border-l-teal-400",
];

interface CalendarBooking {
  id: string;
  scheduled_at: string;
  status: string;
  listings: { title: string } | null;
}

interface CalendarContentProps {
  bookings: CalendarBooking[];
  initialAvailableDates?: string[];
  isCreator?: boolean;
}

export function CalendarContent({ bookings, initialAvailableDates = [], isCreator = false }: CalendarContentProps) {
  const { role } = useRole();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableSet, setAvailableSet] = useState<Set<string>>(new Set(initialAvailableDates));
  const [slotsMap, setSlotsMap] = useState<Record<string, { id: string; start_time: string | null; end_time: string | null }[]>>({});
  const [editMode, setEditMode] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showCreatorTools = isCreator || role === "kreator" || role === "upplevelse";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  // Fetch availability when month changes
  useEffect(() => {
    if (!showCreatorTools) return;
    getAvailability(year, month + 1).then(({ dates, slots }) => {
      setAvailableSet(new Set(dates));
      setSlotsMap(slots || {});
    });
  }, [year, month, showCreatorTools]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

  const getDateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Transform bookings into date-keyed events
  const eventsByDate: Record<string, { title: string; time: string; location: string; color: string }[]> = {};
  bookings.forEach((booking, i) => {
    const date = new Date(booking.scheduled_at);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const timeStr = date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    const event = {
      title: booking.listings?.title || "Bokning",
      time: timeStr,
      location: booking.status === "confirmed" ? "Bekräftad" : "Väntande",
      color: EVENT_COLORS[i % EVENT_COLORS.length],
    };
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    eventsByDate[dateKey].push(event);
  });

  const hasEvents = (day: number) => !!eventsByDate[getDateKey(day)];

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  const allUpcoming = Object.entries(eventsByDate)
    .flatMap(([date, events]) =>
      events.map((e) => ({ ...e, date }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(23, 59, 59);
    return d < today;
  };

  function handleDayClick(day: number) {
    const dateKey = getDateKey(day);

    if (editMode && showCreatorTools && !isPast(day)) {
      // Open slot editor for this date
      setEditingDate(editingDate === dateKey ? null : dateKey);
    } else {
      setSelectedDate(selectedDate === dateKey ? null : dateKey);
    }
  }

  async function handleToggleAllDay(dateKey: string) {
    const wasAvailable = availableSet.has(dateKey);
    setAvailableSet((prev) => {
      const next = new Set(prev);
      if (wasAvailable) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });

    const result = await toggleAvailability(dateKey);
    if (result.error) {
      setAvailableSet((prev) => {
        const reverted = new Set(prev);
        if (wasAvailable) reverted.add(dateKey);
        else reverted.delete(dateKey);
        return reverted;
      });
    } else {
      // Refresh slots
      const res = await getAvailability(year, month + 1);
      setSlotsMap(res.slots || {});
      setAvailableSet(new Set(res.dates));
    }
  }

  async function handleAddSlot(dateKey: string, startTime: string, endTime: string) {
    const result = await addTimeSlot(dateKey, startTime, endTime);
    if (result.error) return result.error;
    const res = await getAvailability(year, month + 1);
    setSlotsMap(res.slots || {});
    setAvailableSet(new Set(res.dates));
    return null;
  }

  async function handleRemoveSlot(slotId: string) {
    await removeTimeSlot(slotId);
    const res = await getAvailability(year, month + 1);
    setSlotsMap(res.slots || {});
    setAvailableSet(new Set(res.dates));
  }

  return (
    <div className="space-y-6">
      {/* Availability toggle for creators */}
      {showCreatorTools && (
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            editMode
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-[var(--usha-card)] text-[var(--usha-muted)] ring-1 ring-[var(--usha-border)] hover:text-white"
          }`}
        >
          <Check size={16} />
          {editMode ? "Klar med tillgänglighet" : "Markera tillgänglighet"}
        </button>
      )}

      {editMode && (
        <p className="text-xs text-emerald-400/70">
          Tryck på ett datum för att lägga till tidsluckor. Grönt = tillgänglig.
        </p>
      )}

      {/* Calendar */}
      <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-[var(--usha-card-hover)]">
            <ChevronLeft size={18} className="text-[var(--usha-muted)]" />
          </button>
          <h2 className="text-base font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-[var(--usha-card-hover)]">
            <ChevronRight size={18} className="text-[var(--usha-muted)]" />
          </button>
        </div>

        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-[var(--usha-muted)]">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateKey = getDateKey(day);
            const isSelected = selectedDate === dateKey;
            const todayDay = isToday(day);
            const eventDay = hasEvents(day);
            const isAvailable = availableSet.has(dateKey);
            const past = isPast(day);

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                disabled={editMode && past}
                className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-all ${
                  isSelected && !editMode
                    ? "bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)] font-bold text-black"
                    : isAvailable && !isSelected
                      ? "bg-emerald-500/15 font-medium text-emerald-400 ring-1 ring-emerald-500/25"
                      : todayDay
                        ? "bg-[var(--usha-gold)]/10 font-semibold text-[var(--usha-gold)]"
                        : past && editMode
                          ? "text-[var(--usha-muted)]/30 cursor-not-allowed"
                          : "hover:bg-[var(--usha-card-hover)]"
                }`}
              >
                {day}
                {/* Event dot */}
                {eventDay && !isSelected && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    <div className="h-1 w-1 rounded-full bg-[var(--usha-gold)]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Time Slot Editor */}
        {editMode && editingDate && (
          <TimeSlotEditor
            dateKey={editingDate}
            slots={slotsMap[editingDate] || []}
            onToggleAllDay={() => handleToggleAllDay(editingDate)}
            onAddSlot={(s, e) => handleAddSlot(editingDate, s, e)}
            onRemoveSlot={handleRemoveSlot}
            isAvailable={availableSet.has(editingDate)}
          />
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-[var(--usha-muted)]">
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-[var(--usha-gold)]" /> Bokning
          </span>
          {showCreatorTools && (
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-emerald-400" /> Tillgänglig
            </span>
          )}
        </div>
      </div>

      {/* Selected date events */}
      {selectedDate && selectedEvents.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">
            {selectedDate.split("-").reverse().join("/")}
          </h3>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {selectedEvents.map((event, i) => (
              <div
                key={i}
                className={`rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 border-l-4 ${event.color}`}
              >
                <h3 className="text-sm font-semibold">{event.title}</h3>
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {event.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {event.location}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      <section>
        <h2 className="mb-4 text-lg font-bold">Kommande Evenemang</h2>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {allUpcoming.length > 0 ? allUpcoming.map((event, i) => (
            <div
              key={i}
              className={`rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 border-l-4 ${event.color}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{event.title}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {event.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={10} />
                      {event.location}
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--usha-gold)]">
                  {event.date.split("-").slice(1).reverse().join("/")}
                </span>
              </div>
            </div>
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-12">
              <Calendar size={32} className="mb-3 text-[var(--usha-muted)]" />
              <p className="text-sm text-[var(--usha-muted)]">Inga kommande evenemang</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Time Slot Editor ───

function TimeSlotEditor({
  dateKey,
  slots,
  onToggleAllDay,
  onAddSlot,
  onRemoveSlot,
  isAvailable,
}: {
  dateKey: string;
  slots: { id: string; start_time: string | null; end_time: string | null }[];
  onToggleAllDay: () => void;
  onAddSlot: (startTime: string, endTime: string) => Promise<string | null>;
  onRemoveSlot: (slotId: string) => void;
  isAvailable: boolean;
}) {
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const dateLabel = new Date(dateKey).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isAllDay = slots.length === 1 && !slots[0].start_time && !slots[0].end_time;
  const hasSpecificSlots = slots.some((s) => s.start_time !== null);

  async function handleAdd() {
    setAdding(true);
    setError("");
    const err = await onAddSlot(newStart, newEnd);
    if (err) setError(err);
    setAdding(false);
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <h4 className="mb-1 text-sm font-semibold capitalize">{dateLabel}</h4>

      {/* All-day toggle */}
      <button
        onClick={onToggleAllDay}
        className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          isAllDay
            ? "bg-emerald-500/20 text-emerald-400"
            : !isAvailable
              ? "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-emerald-400"
              : "bg-[var(--usha-card)] text-[var(--usha-muted)]"
        }`}
      >
        <Check size={12} />
        {isAllDay ? "Hela dagen (aktiv)" : !isAvailable ? "Markera hela dagen" : "Ta bort alla tider"}
      </button>

      {/* Existing slots */}
      {hasSpecificSlots && (
        <div className="mb-3 space-y-1.5">
          {slots.filter((s) => s.start_time).map((slot) => (
            <div key={slot.id} className="flex items-center justify-between rounded-lg bg-[var(--usha-card)] px-3 py-2">
              <span className="text-xs font-medium text-emerald-400">
                {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
              </span>
              <button
                onClick={() => onRemoveSlot(slot.id)}
                className="rounded p-1 text-[var(--usha-muted)] hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new slot */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] text-[var(--usha-muted)]">Starttid</label>
          <input
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-2 py-1.5 text-xs outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[10px] text-[var(--usha-muted)]">Sluttid</label>
          <input
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-2 py-1.5 text-xs outline-none"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Lägg till
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
