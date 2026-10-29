/** Ett pass inom en kväll, "HH:MM"–"HH:MM". */
export type Shift = { start: string; end: string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Båda tiderna satta och slutet efter starten. Pass över midnatt stöds inte. */
export function isValidShift(s: Partial<Shift> | null | undefined): s is Shift {
  return !!s && HHMM.test(s.start ?? "") && HHMM.test(s.end ?? "") && s.start! < s.end!;
}

export function shiftLabel(s: Shift): string {
  return `${s.start}–${s.end}`;
}

/** Utgångsläget innan arrangören satt egna pass: hela kvällen, eller två timmar från start. */
export function defaultShifts(start: string | null, end: string | null): Shift[] {
  const s = start?.slice(0, 5) ?? "";
  if (!HHMM.test(s)) return [{ start: "", end: "" }];
  const e = end?.slice(0, 5) ?? "";
  if (HHMM.test(e) && e > s) return [{ start: s, end: e }];
  const h = Number(s.slice(0, 2)) + 2;
  return [{ start: s, end: h <= 23 ? `${String(h).padStart(2, "0")}${s.slice(2)}` : "" }];
}

/** Läser och validerar formulärets slots-fält. Ogiltigt → null, så att servern kan säga nej. */
export function parseSlots(raw: unknown): Array<Shift & { listing_id: string }> | null {
  if (typeof raw !== "string" || !raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > 100) return null;
  const out: Array<Shift & { listing_id: string }> = [];
  for (const d of data) {
    const r = d as Record<string, unknown>;
    const slot = { listing_id: String(r?.listing_id ?? ""), start: String(r?.start ?? ""), end: String(r?.end ?? "") };
    if (!/^[0-9a-f-]{36}$/i.test(slot.listing_id) || !isValidShift(slot)) return null;
    out.push(slot);
  }
  return out;
}
