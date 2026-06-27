// Lucka 1 — väntelista: delade helpers för validering/normalisering.

// Enkel men robust e-postvalidering (samma nivå som vi använder i kassan):
// kräver lokal del, @, domän med minst en punkt och TLD ≥ 2 tecken.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

/** Normalisera för dedup + lagring: trimma och gemener. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Trimma namn och kapa orimligt långa värden; tomt → null. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, 120);
  return t.length ? t : null;
}

export type WaitlistEntry = {
  id: string;
  listing_id: string;
  name: string | null;
  email: string;
  source: string | null;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
};

/** Bygg en CSV (RFC-4180-citerad) av väntelisteposter för host-export. */
export function waitlistToCsv(rows: WaitlistEntry[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["name", "email", "signed_up_at", "status"].map(esc).join(",");
  const lines = rows.map((r) =>
    [
      esc(r.name ?? ""),
      esc(r.email),
      esc(r.created_at),
      esc(r.unsubscribed_at ? "unsubscribed" : "active"),
    ].join(",")
  );
  return [header, ...lines].join("\r\n");
}
