"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Clock, Calendar } from "lucide-react";
import { useRole } from "@/components/mobile/role-context";

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
}

export function CalendarContent({ bookings }: CalendarContentProps) {
  const { role } = useRole();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

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

  // Get all upcoming events sorted
  const allUpcoming = Object.entries(eventsByDate)
    .flatMap(([date, events]) =>
      events.map((e) => ({ ...e, date }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  // Check if a day is today
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Kalender</h1>

      {/* Calendar header */}
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

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-all ${
                  isSelected
                    ? "bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)] font-bold text-black"
                    : todayDay
                      ? "bg-[var(--usha-gold)]/10 font-semibold text-[var(--usha-gold)]"
                      : "hover:bg-[var(--usha-card-hover)]"
                }`}
              >
                {day}
                {eventDay && !isSelected && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    <div className="h-1 w-1 rounded-full bg-[var(--usha-gold)]" />
                  </div>
                )}
              </button>
            );
          })}
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
