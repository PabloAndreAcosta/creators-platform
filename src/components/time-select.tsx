"use client";

import { useState } from "react";

/**
 * Tidsväljare med två rullgardiner i stället för <input type="time">.
 *
 * Den inbyggda tidsväljaren öppnar operativsystemets egen dialog, och i appens
 * WebView på Android klipps den vid skärmkanten — knappen "Ange" hamnar utanför
 * bild och tiden går inte att bekräfta. Dialogen är systemets, så felet går inte
 * att styla bort.
 *
 * Två rullgardiner ser likadana ut överallt, går att nå med tangentbord, och är
 * snabbare på mobil än en urtavla: två tryck i stället för att sikta på en
 * visare. Fem minuters steg, eftersom evenemang börjar 19.00 eller 19.30 — inte
 * 19.07. Behövs finare upplösning någonstans sätts minuteStep.
 *
 * Fungerar både som formulärfält (name + defaultValue → dolt fält) och
 * kontrollerat (value + onChange), eftersom appen använder båda mönstren.
 */
export default function TimeSelect({
  name,
  id,
  defaultValue,
  value,
  onChange,
  minuteStep = 5,
  className = "",
  compact = false,
}: {
  name?: string;
  id?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  minuteStep?: number;
  className?: string;
  /** Mindre variant för trängre ytor, t.ex. kalenderns tidsrader. */
  compact?: boolean;
}) {
  const kontrollerad = value !== undefined && onChange !== undefined;

  // Databasen kan ge "19:00:00"; bara timme och minut intresserar oss.
  const start = ((kontrollerad ? value : defaultValue) ?? "").slice(0, 5);
  const [internal, setInternal] = useState(start);
  const aktuell = kontrollerad ? (value as string).slice(0, 5) : internal;

  const hour = aktuell ? aktuell.slice(0, 2) : "";
  const minute = aktuell ? aktuell.slice(3, 5) : "";

  // En halv tid är ingen tid. Skickas bara när båda är valda, så fältet kan
  // lämnas tomt som förut och servern slipper tolka "19:".
  function set(h: string, m: string) {
    const next = h && m ? `${h}:${m}` : "";
    if (kontrollerad) onChange!(next);
    else setInternal(next);
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
    String(i * minuteStep).padStart(2, "0")
  );

  const selectClass = compact
    ? "min-w-0 flex-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-2 py-1.5 text-xs outline-none focus:border-[var(--usha-gold)]/40"
    : "min-w-0 flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {name && <input type="hidden" name={name} value={aktuell} />}
      <select
        id={id}
        aria-label="Timme"
        value={hour}
        onChange={(e) => set(e.target.value, minute)}
        className={selectClass}
      >
        <option value="">--</option>
        {hours.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span aria-hidden="true" className="text-[var(--usha-muted)]">:</span>
      <select
        aria-label="Minut"
        value={minute}
        onChange={(e) => set(hour, e.target.value)}
        className={selectClass}
      >
        <option value="">--</option>
        {minutes.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
