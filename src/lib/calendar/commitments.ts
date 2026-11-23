/**
 * Egna åtaganden i bokningskalendern: festivaler, dansjobb, kurser och annat
 * som användaren själv går på eller jobbar på. Rena funktioner — samma regler
 * som CHECK-villkoren i supabase/migrations-historik/20261120_egna_ataganden.sql, så
 * att ett fel fångas med ett begripligt meddelande innan databasen säger nej.
 */

export const COMMITMENT_KINDS = ["festival", "jobb", "kurs", "annat"] as const;
export type CommitmentKind = (typeof COMMITMENT_KINDS)[number];

/** Syfte med resan/åtagandet — för att se vad pengarna går till. */
export const COMMITMENT_PURPOSES = ["jobb", "larande", "natverk", "marknadsforing", "noje", "annat"] as const;
export type CommitmentPurpose = (typeof COMMITMENT_PURPOSES)[number];

export const COMMITMENT_SOURCES = ["manual", "google"] as const;
export type CommitmentSource = (typeof COMMITMENT_SOURCES)[number];

export const COMMITMENT_LIMITS = {
  title: 120,
  role: 60,
  location: 160,
  note: 1000,
  costNote: 500,
  externalUid: 500,
  /** Per belopp: 1 000 000 kr i öre. Skydd mot felslag, inte en affärsregel. */
  amountOre: 100_000_000,
} as const;

/** Beloppsfälten, alla i öre (SEK), alla valfria. */
export const COMMITMENT_COST_FIELDS = [
  "cost_transport_ore",
  "cost_lodging_ore",
  "cost_food_ore",
  "cost_ticket_ore",
  "cost_other_ore",
] as const;
export type CommitmentCostField = (typeof COMMITMENT_COST_FIELDS)[number];
export const COMMITMENT_AMOUNT_FIELDS = [...COMMITMENT_COST_FIELDS, "income_ore"] as const;
export type CommitmentAmountField = (typeof COMMITMENT_AMOUNT_FIELDS)[number];

export interface CommitmentEconomics {
  purpose: CommitmentPurpose | null;
  cost_transport_ore: number | null;
  cost_lodging_ore: number | null;
  cost_food_ore: number | null;
  cost_ticket_ore: number | null;
  cost_other_ore: number | null;
  income_ore: number | null;
  cost_note: string | null;
}

export interface Commitment extends CommitmentEconomics {
  id: string;
  title: string;
  kind: CommitmentKind;
  role: string | null;
  start_date: string;
  end_date: string;
  location: string | null;
  note: string | null;
  source: CommitmentSource;
  external_uid: string | null;
}

/** Kolumnerna som läses och returneras — en lista, så att sida och åtgärder inte glider isär. */
export const COMMITMENT_COLUMNS =
  "id, title, kind, role, start_date, end_date, location, note, purpose, cost_transport_ore, cost_lodging_ore, cost_food_ore, cost_ticket_ore, cost_other_ore, income_ore, cost_note, source, external_uid";

export interface CommitmentInput {
  title?: unknown;
  kind?: unknown;
  role?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  location?: unknown;
  note?: unknown;
  purpose?: unknown;
  cost_transport_ore?: unknown;
  cost_lodging_ore?: unknown;
  cost_food_ore?: unknown;
  cost_ticket_ore?: unknown;
  cost_other_ore?: unknown;
  income_ore?: unknown;
  cost_note?: unknown;
  /** Satt när åtagandet läggs till från en importerad kalender. */
  external_uid?: unknown;
}

/** Felkoder översätts i klienten (calendarPage.commitmentError_<kod>). */
export type CommitmentErrorCode =
  | "titleRequired"
  | "titleTooLong"
  | "kindInvalid"
  | "roleTooLong"
  | "dateInvalid"
  | "endBeforeStart"
  | "locationTooLong"
  | "noteTooLong"
  | "purposeInvalid"
  | "amountInvalid"
  | "costNoteTooLong"
  | "externalUidInvalid";

/** Svenska meddelanden för serveråtgärderna, som resten av actions.ts. */
export const COMMITMENT_ERROR_SV: Record<CommitmentErrorCode, string> = {
  titleRequired: "Ange en titel",
  titleTooLong: `Titeln får vara högst ${COMMITMENT_LIMITS.title} tecken`,
  kindInvalid: "Välj typ av åtagande",
  roleTooLong: `Rollen får vara högst ${COMMITMENT_LIMITS.role} tecken`,
  dateInvalid: "Ange giltiga datum",
  endBeforeStart: "Slutdatum kan inte vara före startdatum",
  locationTooLong: `Platsen får vara högst ${COMMITMENT_LIMITS.location} tecken`,
  noteTooLong: `Anteckningen får vara högst ${COMMITMENT_LIMITS.note} tecken`,
  purposeInvalid: "Välj ett giltigt syfte",
  amountInvalid: "Beloppen ska vara hela kronor mellan 0 och 1 000 000",
  costNoteTooLong: `Kostnadsanteckningen får vara högst ${COMMITMENT_LIMITS.costNote} tecken`,
  externalUidInvalid: "Ogiltig kalenderhändelse",
};

export const COMMITMENT_DAY_BLOCKED_SV = "Du har ett åtagande den dagen";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD som också är ett riktigt kalenderdatum (inte 2026-02-30). */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Tom sträng och bara mellanslag blir null, som i databasen. */
function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Det som valideringen ger tillbaka och som skrivs till databasen. */
export type CommitmentValues = Omit<Commitment, "id" | "source" | "external_uid"> & {
  external_uid: string | null;
};

export type CommitmentValidation =
  | { ok: true; value: CommitmentValues }
  | { ok: false; code: CommitmentErrorCode };

/** Belopp i öre: null/tomt = inte angivet, annars ett heltal inom gränsen. */
function parseAmountOre(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return "invalid";
  if (value < 0 || value > COMMITMENT_LIMITS.amountOre) return "invalid";
  return value;
}

/**
 * Kronor som användaren skriver ("1 800", "1800,50", "1.800") → öre.
 * Tomt → null. Ogiltigt → "invalid". Punkt följd av exakt tre siffror läses
 * som tusentalsavgränsare, annars som decimal.
 */
export function kronorToOre(text: string): number | null | "invalid" {
  const cleaned = text.replace(/[\s\u00a0]/g, "").replace(/kr$/i, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, "");
  normalized = normalized.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return "invalid";
  const ore = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(ore) || ore > COMMITMENT_LIMITS.amountOre) return "invalid";
  return ore;
}

/** Öre → text för ett inmatningsfält i kronor ("" när inget är angivet). */
export function oreToKronorInput(ore: number | null | undefined): string {
  if (ore === null || ore === undefined) return "";
  return ore % 100 === 0 ? String(ore / 100) : (ore / 100).toFixed(2).replace(".", ",");
}

export function validateCommitment(input: CommitmentInput): CommitmentValidation {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, code: "titleRequired" };
  if (title.length > COMMITMENT_LIMITS.title) return { ok: false, code: "titleTooLong" };

  if (typeof input.kind !== "string" || !(COMMITMENT_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, code: "kindInvalid" };
  }

  const role = optionalText(input.role);
  if (role && role.length > COMMITMENT_LIMITS.role) return { ok: false, code: "roleTooLong" };

  if (!isValidDateKey(input.start_date) || !isValidDateKey(input.end_date)) {
    return { ok: false, code: "dateInvalid" };
  }
  // ISO-datum jämförs korrekt som strängar.
  if (input.end_date < input.start_date) return { ok: false, code: "endBeforeStart" };

  const location = optionalText(input.location);
  if (location && location.length > COMMITMENT_LIMITS.location) return { ok: false, code: "locationTooLong" };

  const note = optionalText(input.note);
  if (note && note.length > COMMITMENT_LIMITS.note) return { ok: false, code: "noteTooLong" };

  let purpose: CommitmentPurpose | null = null;
  if (input.purpose !== null && input.purpose !== undefined && input.purpose !== "") {
    if (typeof input.purpose !== "string" || !(COMMITMENT_PURPOSES as readonly string[]).includes(input.purpose)) {
      return { ok: false, code: "purposeInvalid" };
    }
    purpose = input.purpose as CommitmentPurpose;
  }

  const amounts = {} as Record<CommitmentAmountField, number | null>;
  for (const field of COMMITMENT_AMOUNT_FIELDS) {
    const parsed = parseAmountOre(input[field]);
    if (parsed === "invalid") return { ok: false, code: "amountInvalid" };
    amounts[field] = parsed;
  }

  const costNote = optionalText(input.cost_note);
  if (costNote && costNote.length > COMMITMENT_LIMITS.costNote) return { ok: false, code: "costNoteTooLong" };

  let externalUid: string | null = null;
  if (input.external_uid !== null && input.external_uid !== undefined && input.external_uid !== "") {
    if (typeof input.external_uid !== "string" || input.external_uid.length > COMMITMENT_LIMITS.externalUid) {
      return { ok: false, code: "externalUidInvalid" };
    }
    externalUid = input.external_uid;
  }

  return {
    ok: true,
    value: {
      title,
      kind: input.kind as CommitmentKind,
      role,
      start_date: input.start_date,
      end_date: input.end_date,
      location,
      note,
      purpose,
      ...amounts,
      cost_note: costNote,
      external_uid: externalUid,
    },
  };
}

// ─── Ekonomi: uppskattade summor ───

export interface EconomicsTotals {
  cost: number;
  income: number;
  net: number;
}

/** Summan av kostnadsfälten i öre; null om inget belopp alls är angivet. */
export function commitmentTotals(c: Partial<CommitmentEconomics>): EconomicsTotals | null {
  const hasAny = COMMITMENT_AMOUNT_FIELDS.some((f) => typeof c[f] === "number");
  if (!hasAny) return null;
  const cost = COMMITMENT_COST_FIELDS.reduce((sum, f) => sum + (c[f] ?? 0), 0);
  const income = c.income_ore ?? 0;
  return { cost, income, net: income - cost };
}

export interface EconomicsSummary extends EconomicsTotals {
  /** Antal åtaganden med minst ett belopp. */
  counted: number;
  /** Per syfte; åtaganden utan syfte hamnar under "none". */
  byPurpose: Partial<Record<CommitmentPurpose | "none", EconomicsTotals>>;
}

export function summarizeEconomics(list: Partial<CommitmentEconomics>[]): EconomicsSummary {
  const summary: EconomicsSummary = { cost: 0, income: 0, net: 0, counted: 0, byPurpose: {} };
  for (const c of list) {
    const totals = commitmentTotals(c);
    if (!totals) continue;
    summary.counted += 1;
    summary.cost += totals.cost;
    summary.income += totals.income;
    summary.net += totals.net;
    const key = c.purpose ?? "none";
    const bucket = (summary.byPurpose[key] ??= { cost: 0, income: 0, net: 0 });
    bucket.cost += totals.cost;
    bucket.income += totals.income;
    bucket.net += totals.net;
  }
  return summary;
}

type DateRange = Pick<Commitment, "start_date" | "end_date">;

/** Ligger datumet (YYYY-MM-DD) inom något av åtagandena, ändpunkterna inräknade? */
export function isDateInCommitments(date: string, commitments: DateRange[]): boolean {
  return commitments.some((c) => c.start_date <= date && date <= c.end_date);
}

/**
 * Alla dagar som åtagandena täcker mellan from och to (båda inklusive).
 * Används för att markera dagarna i månadsrutnätet; klipps mot intervallet så
 * att en festival över månadsskiftet inte expanderar hela året.
 */
export function commitmentDaysInRange(commitments: DateRange[], from: string, to: string): Set<string> {
  const days = new Set<string>();
  for (const c of commitments) {
    const start = c.start_date > from ? c.start_date : from;
    const end = c.end_date < to ? c.end_date : to;
    if (start > end) continue;
    const [y, m, d] = start.split("-").map(Number);
    const cursor = new Date(Date.UTC(y, m - 1, d));
    for (;;) {
      const key = cursor.toISOString().slice(0, 10);
      if (key > end) break;
      days.add(key);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return days;
}

/** "4/12" för en dag, "4/12 – 6/12" för ett intervall (dag/månad som resten av kalendersidan). */
export function formatCommitmentRange(c: Pick<Commitment, "start_date" | "end_date">): string {
  const fmt = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
  return c.start_date === c.end_date ? fmt(c.start_date) : `${fmt(c.start_date)} – ${fmt(c.end_date)}`;
}
