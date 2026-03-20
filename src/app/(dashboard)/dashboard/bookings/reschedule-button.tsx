"use client";

import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

const btnBase =
  "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

interface RescheduleButtonProps {
  bookingId: string;
  currentDate: string;
  onRescheduled?: () => void;
}

export function RescheduleButton({
  bookingId,
  currentDate,
  onRescheduled,
}: RescheduleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Tomorrow as minimum selectable date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // Pre-fill with current date/time
  function handleOpen() {
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
    if (!date || !time) {
      setError("Välj datum och tid.");
      return;
    }

    const newDate = new Date(`${date}T${time}:00`);
    if (isNaN(newDate.getTime())) {
      setError("Ogiltigt datum eller tid.");
      return;
    }

    if (newDate <= new Date()) {
      setError("Datumet måste vara i framtiden.");
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
          setError(data.error || "Något gick fel.");
          return;
        }

        toast.success("Bokning ombokad");
        setIsOpen(false);
        onRescheduled?.();
      } catch {
        setError("Kunde inte ansluta till servern.");
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
        Omboka
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--usha-border)] p-3">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-[var(--usha-border)] bg-transparent px-2 py-1 text-xs"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-[var(--usha-border)] bg-transparent px-2 py-1 text-xs"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className={`${btnBase} bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50`}
        >
          {isPending ? "Ombokar…" : "Bekräfta nytt datum"}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-xs text-[var(--usha-muted)] hover:underline"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
