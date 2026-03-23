"use client";

import { useState, useTransition, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toggleAvailability, getAvailability } from "@/app/app/calendar/actions";

interface CalendarBooking {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  personName: string;
  type: "incoming" | "outgoing";
}

interface BookingCalendarProps {
  bookings: CalendarBooking[];
  isCreator?: boolean;
  initialAvailableDates?: string[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  confirmed: "bg-green-500",
  completed: "bg-blue-500",
  canceled: "bg-red-500/50",
};

const WEEKDAYS = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];
const MONTHS = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

export function BookingCalendar({ bookings, isCreator = false, initialAvailableDates = [] }: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availableSet, setAvailableSet] = useState<Set<string>>(new Set(initialAvailableDates));
  const [editMode, setEditMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month (0=Sun, adjust for Mon-start)
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Group bookings by day
  const bookingsByDay = new Map<number, CalendarBooking[]>();
  for (const b of bookings) {
    const d = new Date(b.scheduledAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!bookingsByDay.has(day)) bookingsByDay.set(day, []);
      bookingsByDay.get(day)!.push(b);
    }
  }

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(23, 59, 59);
    return d < today;
  };

  const getDateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Fetch availability when month changes
  useEffect(() => {
    if (!isCreator) return;
    getAvailability(year, month + 1).then(({ dates }) => {
      setAvailableSet(new Set(dates));
    });
  }, [year, month, isCreator]);

  function handleDayClick(day: number) {
    if (!editMode || !isCreator || isPast(day)) return;
    const dateKey = getDateKey(day);
    const wasAvailable = availableSet.has(dateKey);
    // Optimistic update
    setAvailableSet((prev) => {
      const next = new Set(prev);
      if (wasAvailable) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
    startTransition(async () => {
      const result = await toggleAvailability(dateKey);
      if (result.error) {
        setAvailableSet((prev) => {
          const reverted = new Set(prev);
          if (wasAvailable) reverted.add(dateKey);
          else reverted.delete(dateKey);
          return reverted;
        });
      }
    });
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="space-y-4">
      {/* Availability toggle for creators */}
      {isCreator && (
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
          Tryck på datum för att markera dig som tillgänglig. Grönt = tillgänglig.
        </p>
      )}

    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/10"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold capitalize">
          {MONTHS[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/10"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium uppercase text-[var(--usha-muted)]">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const dayBookings = bookingsByDay.get(day) ?? [];
          const hasBookings = dayBookings.length > 0;
          const dateKey = getDateKey(day);
          const isAvailable = availableSet.has(dateKey);
          const past = isPast(day);

          return (
            <div
              key={day}
              onClick={() => handleDayClick(day)}
              className={`group relative flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-xs transition ${
                editMode && isCreator
                  ? past
                    ? "text-[var(--usha-muted)]/30 cursor-not-allowed"
                    : "cursor-pointer hover:bg-white/10"
                  : ""
              } ${
                isAvailable
                  ? "bg-emerald-500/15 ring-1 ring-emerald-500/25"
                  : ""
              } ${
                isToday(day)
                  ? "bg-[var(--usha-gold)]/10 font-bold text-[var(--usha-gold)]"
                  : hasBookings && !isAvailable
                  ? "bg-white/5 hover:bg-white/10"
                  : !isAvailable
                  ? "text-[var(--usha-muted)]"
                  : ""
              }`}
            >
              <span className="text-[11px]">{day}</span>
              {/* Booking dots */}
              {dayBookings.length > 0 && (
                <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {dayBookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[b.status] || "bg-gray-500"}`}
                      title={`${b.title} — ${b.personName}`}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className="text-[8px] text-[var(--usha-muted)]">+{dayBookings.length - 3}</span>
                  )}
                </div>
              )}

              {/* Tooltip on hover */}
              {hasBookings && (
                <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden w-48 -translate-x-1/2 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] p-2 shadow-xl group-hover:block">
                  {dayBookings.map((b) => (
                    <div key={b.id} className="mb-1 last:mb-0">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[b.status] || "bg-gray-500"}`} />
                        <span className="truncate text-[10px] font-medium">{b.title}</span>
                      </div>
                      <p className="ml-3 text-[9px] text-[var(--usha-muted)]">
                        {b.type === "incoming" ? "Kund" : "Kreatör"}: {b.personName}
                        {" — "}
                        {new Date(b.scheduledAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-[var(--usha-border)] pt-3">
        {[
          { label: "Väntande", color: "bg-yellow-500" },
          { label: "Bekräftad", color: "bg-green-500" },
          { label: "Slutförd", color: "bg-blue-500" },
          { label: "Avbokad", color: "bg-red-500/50" },
          ...(isCreator ? [{ label: "Tillgänglig", color: "bg-emerald-400" }] : []),
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="text-[10px] text-[var(--usha-muted)]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
