"use client";

import { useState } from "react";
import Image from "next/image";
import { User, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { MINUTE_OPTIONS, priceForMinutes, type MinuteOption } from "@/lib/coaching/minute-pricing";

interface Props {
  listingId: string;
  instructorId: string;
  instructorName: string;
  avatarUrl: string | null;
  specialties: string[];
  hourlyRate: number;
  isLoggedIn: boolean;
  disabledReason?: string; // e.g. "Det här är du" / host
}

export function InstructorMinutesCard({
  listingId,
  instructorId,
  instructorName,
  avatarUrl,
  specialties,
  hourlyRate,
  isLoggedIn,
  disabledReason,
}: Props) {
  const { toast } = useToast();
  const [minutes, setMinutes] = useState<MinuteOption>(30);
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/instructor-minutes-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, instructorId, minutes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Kunde inte starta köpet.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Kunde inte starta köpet. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={instructorName} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <User size={18} className="text-[var(--usha-gold)]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{instructorName}</p>
          {specialties.length > 0 && (
            <p className="truncate text-xs text-[var(--usha-muted)]">{specialties.join(" · ")}</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {MINUTE_OPTIONS.map((m) => {
          const selected = m === minutes;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={`flex flex-col items-center rounded-lg border px-1 py-2 text-center transition ${
                selected
                  ? "border-[var(--usha-gold)] bg-[var(--usha-gold)]/10"
                  : "border-[var(--usha-border)] hover:border-[var(--usha-gold)]/40"
              }`}
            >
              <span className="text-sm font-semibold">{m} min</span>
              <span className="text-[11px] text-[var(--usha-muted)]">{priceForMinutes(hourlyRate, m)} kr</span>
            </button>
          );
        })}
      </div>

      {disabledReason ? (
        <p className="mt-3 text-center text-xs text-[var(--usha-muted)]">{disabledReason}</p>
      ) : !isLoggedIn ? (
        <a
          href="/login"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
        >
          <Clock size={14} />
          Logga in för att köpa
        </a>
      ) : (
        <button
          onClick={handleBuy}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
          Köp {minutes} min · {priceForMinutes(hourlyRate, minutes)} kr
        </button>
      )}
    </div>
  );
}
