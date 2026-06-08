"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, List } from "lucide-react";
import { BookingCalendar } from "@/components/booking-calendar";

interface CalendarBooking {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  personName: string;
  type: "incoming" | "outgoing";
}

interface BookingsViewToggleProps {
  bookings: CalendarBooking[];
  listView: React.ReactNode;
  isCreator?: boolean;
  initialAvailableDates?: string[];
}

export function BookingsViewToggle({ bookings, listView, isCreator = false, initialAvailableDates = [] }: BookingsViewToggleProps) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const t = useTranslations("bookingsPage");

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-lg bg-[var(--usha-border)] p-0.5 w-fit">
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            view === "list"
              ? "bg-[var(--usha-card)] text-[var(--usha-white)] shadow-sm"
              : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          }`}
        >
          <List size={13} />
          {t("viewListLabel")}
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            view === "calendar"
              ? "bg-[var(--usha-card)] text-[var(--usha-white)] shadow-sm"
              : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          }`}
        >
          <CalendarDays size={13} />
          {t("viewCalendarLabel")}
        </button>
      </div>

      {view === "list" ? listView : <BookingCalendar bookings={bookings} isCreator={isCreator} initialAvailableDates={initialAvailableDates} />}
    </>
  );
}
