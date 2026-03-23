"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAvailability } from "@/app/app/calendar/actions";

const WEEKDAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

interface AvailabilityCalendarProps {
  creatorId: string;
  initialAvailableDates?: string[];
}

export function AvailabilityCalendar({ creatorId, initialAvailableDates = [] }: AvailabilityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availableSet, setAvailableSet] = useState<Set<string>>(new Set(initialAvailableDates));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    getAvailability(year, month + 1, creatorId).then(({ dates }) => {
      setAvailableSet(new Set(dates));
    });
  }, [year, month, creatorId]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);

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

  const hasAnyAvailability = availableSet.size > 0;

  if (!hasAnyAvailability) return null;

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <h3 className="mb-3 text-sm font-semibold">Tillgänglighet</h3>

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="rounded-lg p-1.5 hover:bg-white/10"
        >
          <ChevronLeft size={14} className="text-[var(--usha-muted)]" />
        </button>
        <span className="text-xs font-medium">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="rounded-lg p-1.5 hover:bg-white/10"
        >
          <ChevronRight size={14} className="text-[var(--usha-muted)]" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[9px] font-medium text-[var(--usha-muted)]">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="h-7" />;
          const isAvailable = availableSet.has(getDateKey(day));
          const past = isPast(day);

          return (
            <div
              key={day}
              className={`flex h-7 items-center justify-center rounded text-[11px] ${
                past
                  ? "text-[var(--usha-muted)]/30"
                  : isAvailable
                  ? "bg-emerald-500/15 font-medium text-emerald-400 ring-1 ring-emerald-500/25"
                  : isToday(day)
                  ? "font-bold text-[var(--usha-gold)]"
                  : "text-[var(--usha-muted)]"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-1.5 text-[9px] text-[var(--usha-muted)]">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Tillgänglig för bokning
      </div>
    </div>
  );
}
