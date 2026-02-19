"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";
import { useRole } from "@/components/mobile/role-context";

const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

// Mock events with dates
const MOCK_EVENTS: Record<string, { title: string; time: string; location: string; color: string }[]> = {
  "2026-02-15": [
    { title: "Street Dance Workshop", time: "18:00 - 19:30", location: "Dansens Hus", color: "border-l-[var(--usha-gold)]" },
  ],
  "2026-02-18": [
    { title: "Salsa Social", time: "20:00 - 23:00", location: "Club Havana", color: "border-l-[var(--usha-accent)]" },
  ],
  "2026-02-20": [
    { title: "Akustisk Kväll", time: "19:00 - 21:00", location: "Malmö Live", color: "border-l-emerald-400" },
  ],
  "2026-02-22": [
    { title: "Foto Workshop", time: "10:00 - 14:00", location: "Fotografiska", color: "border-l-blue-400" },
    { title: "Yoga i Parken", time: "16:00 - 17:30", location: "Folkets Park", color: "border-l-purple-400" },
  ],
  "2026-02-25": [
    { title: "Jazz på Taket", time: "21:00 - 23:00", location: "Rooftop Bar", color: "border-l-[var(--usha-gold)]" },
  ],
  "2026-02-28": [
    { title: "Wellness Retreat", time: "09:00 - 17:00", location: "Ribersborg Spa", color: "border-l-teal-400" },
  ],
};

export function CalendarContent() {
  const { role } = useRole();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 12));
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

  const hasEvents = (day: number) => !!MOCK_EVENTS[getDateKey(day)];

  const selectedEvents = selectedDate ? MOCK_EVENTS[selectedDate] || [] : [];

  // Get all upcoming events sorted
  const allUpcoming = Object.entries(MOCK_EVENTS)
    .flatMap(([date, events]) =>
      events.map((e) => ({ ...e, date }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));

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
            const isToday = day === 12 && month === 1 && year === 2026;
            const eventDay = hasEvents(day);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-all ${
                  isSelected
                    ? "bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)] font-bold text-black"
                    : isToday
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
          <div className="space-y-3">
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
        <div className="space-y-3">
          {allUpcoming.map((event, i) => (
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
          ))}
        </div>
      </section>
    </div>
  );
}
