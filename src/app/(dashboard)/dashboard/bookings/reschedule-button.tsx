"use client";

import TimeSelect from "@/components/time-select";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

const btnBase =
  "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

export interface Occurrence {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM:SS" eller null */
  time: string | null;
}

interface RescheduleButtonProps {
  bookingId: string;
  currentDate: string;
  /**
   * Kommande kvällar i serien. Tom lista = tjänstebokning, och då visas den
   * fria datumväljaren som förut.
   *
   * En biljett bor på en kväll (listings.event_date) och det är den dörren
   * läser. Förut skrev knappen bara scheduled_at — bokningen såg ombokad ut i
   * listan och gästen nekades ändå i dörren.
   */
  occurrences?: Occurrence[];
  currentListingId?: string;
  onRescheduled?: () => void;
}

export function RescheduleButton({
  bookingId,
  currentDate,
  occurrences = [],
  currentListingId,
  onRescheduled,
}: RescheduleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [occurrenceId, setOccurrenceId] = useState("");

  // Kvällar man kan flytta TILL — den bokningen redan ligger på är inget val.
  const choices = occurrences.filter((o) => o.id !== currentListingId);
  const isTicket = occurrences.length > 0;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const t = useTranslations("bookingsPage");

  // Tomorrow as minimum selectable date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // Pre-fill with current date/time
  function handleOpen() {
    setOccurrenceId(choices[0]?.id ?? "");
    const current = new Date(currentDate);
    setDate(current.toISOString().split("T")[0]);
    setTime(
      current.toLocaleTimeString("sv-SE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
    setError(null);
    setIsOpen(true);
  }

  function handleCancel() {
    setIsOpen(false);
    setError(null);
  }

  function handleSubmit() {
    if (isTicket) {
      if (!occurrenceId) {
        setError(t("errorSelectOccurrence"));
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch("/api/bookings/reschedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, newListingId: occurrenceId }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || t("errorGeneric"));
            return;
          }
          toast.success(t("toastRescheduleSuccess"));
          setIsOpen(false);
          onRescheduled?.();
        } catch {
          setError(t("errorConnection"));
        }
      });
      return;
    }

    if (!date || !time) {
      setError(t("errorSelectDateTime"));
      return;
    }

    const newDate = new Date(`${date}T${time}:00`);
    if (isNaN(newDate.getTime())) {
      setError(t("errorInvalidDateTime"));
      return;
    }

    if (newDate <= new Date()) {
      setError(t("errorPastDate"));
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/bookings/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            newDate: newDate.toISOString(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || t("errorGeneric"));
          return;
        }

        toast.success(t("toastRescheduleSuccess"));
        setIsOpen(false);
        onRescheduled?.();
      } catch {
        setError(t("errorConnection"));
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className={`${btnBase} border border-[var(--usha-border)] text-[var(--usha-muted)] hover:bg-orange-500/10 hover:text-orange-400`}
      >
        <Calendar size={12} />
        {t("rescheduleButton")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--usha-border)] p-3">
      {isTicket ? (
        // Biljett: välj bland seriens kommande kvällar. En fri datumväljare
        // vore fel här — biljetten måste landa på en kväll som finns, annars
        // nekas den i dörren.
        choices.length === 0 ? (
          <p className="text-xs text-[var(--usha-muted)]">{t("noOtherOccurrences")}</p>
        ) : (
          <select
            value={occurrenceId}
            onChange={(e) => setOccurrenceId(e.target.value)}
            aria-label={t("rescheduleOccurrenceLabel")}
            className="rounded-lg border border-[var(--usha-border)] bg-transparent px-2 py-1 text-xs"
          >
            {choices.map((o) => (
              <option key={o.id} value={o.id}>
                {new Date(`${o.date}T12:00:00`).toLocaleDateString("sv-SE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                {o.time ? ` kl. ${o.time.slice(0, 5)}` : ""}
              </option>
            ))}
          </select>
        )
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--usha-border)] bg-transparent px-2 py-1 text-xs"
          />
          <TimeSelect compact value={time} onChange={setTime} />
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || (isTicket && choices.length === 0)}
          className={`${btnBase} bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50`}
        >
          {isPending ? t("rescheduleSubmitting") : t("rescheduleConfirmLabel")}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-xs text-[var(--usha-muted)] hover:underline"
        >
          {t("rescheduleCancel")}
        </button>
      </div>
    </div>
  );
}
