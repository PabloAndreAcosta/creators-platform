import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Visa att jag kommer" — vem som får synas bland deltagarna, och när raden
 * över huvud taget ska visas.
 *
 * Två spärrar, och de gör olika saker:
 *
 * 1. SAMTYCKE, per person. Bara den som aktivt kryssat i kassan
 *    (bookings.show_attendance) och har en publik profil syns. Köp är inget
 *    samtycke, och en dold profil förblir dold — annars vore inställningen på
 *    profilen en lögn.
 *
 * 2. TRÖSKEL, per evenemang. Raden visas först när nog många svarat.
 *    "3 personer kommer" säljer sämre än att inte skriva något alls, och de
 *    första kvällarna har låga tal. Samma grind som /kalender har på utbud.
 *
 * Siffran räknar ALLA bokningar, inte bara de som syns. Den som inte kryssat
 * ska räknas — hen kommer ju — men inte visas.
 */

export const DEFAULT_ATTENDEES_MIN_DISPLAY = 5;

export interface AttendeeCandidate {
  showAttendance: boolean | null;
  /** Null för gästköp utan konto: ingen profil, inget att visa. */
  profile: { id: string; fullName: string | null; avatarUrl: string | null; isPublic: boolean | null } | null;
}

export interface VisibleAttendee {
  id: string;
  /** Förnamn räcker. Raden är social bekräftelse, inte en deltagarförteckning. */
  firstName: string;
  avatarUrl: string | null;
}

/** Förnamnet ur ett fullständigt namn. Tomt namn ger tom sträng. */
export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * De som får visas. Filtrerar bort allt utan uttryckligt ja, allt utan profil
 * och alla dolda profiler, och slår ihop dubbletter — samma person kan ha köpt
 * två gånger och ska ändå bara synas en gång.
 */
export function visibleAttendees(candidates: readonly AttendeeCandidate[]): VisibleAttendee[] {
  const byId = new Map<string, VisibleAttendee>();
  for (const c of candidates) {
    if (!c.showAttendance) continue;
    if (!c.profile || !c.profile.isPublic) continue;
    const firstName = firstNameOf(c.profile.fullName);
    if (!firstName) continue;
    if (!byId.has(c.profile.id)) {
      byId.set(c.profile.id, { id: c.profile.id, firstName, avatarUrl: c.profile.avatarUrl });
    }
  }
  return [...byId.values()];
}

/**
 * Ska raden visas alls? Kräver både att funktionen är påslagen och att
 * evenemanget nått tröskeln.
 */
export function shouldShowAttendees(
  enabled: boolean,
  totalResponses: number,
  minDisplay: number
): boolean {
  return enabled && totalResponses >= minDisplay;
}

const TTL_MS = 5 * 60_000;
let cached: { enabled: boolean; min: number; at: number } | null = null;

/**
 * Flaggan och tröskeln ur app_config. Samma mönster som calendar_min_supply —
 * ändras i databasen, ingen deploy. Vid läsfel: avstängt, eftersom ett fel
 * aldrig ska leda till att folk exponeras.
 */
export async function getAttendeesDisplayConfig(): Promise<{ enabled: boolean; minDisplay: number }> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) {
    return { enabled: cached.enabled, minDisplay: cached.min };
  }

  let enabled = false;
  let min = DEFAULT_ATTENDEES_MIN_DISPLAY;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_config")
      .select("key, value")
      .in("key", ["attendees_display_enabled", "attendees_min_display"]);
    for (const row of data ?? []) {
      if (row.key === "attendees_display_enabled") enabled = String(row.value) === "true";
      if (row.key === "attendees_min_display") {
        const n = Number(row.value);
        if (Number.isFinite(n) && n >= 0) min = n;
      }
    }
  } catch {
    // Avstängt vid läsfel — se kommentaren ovan.
  }

  cached = { enabled, min, at: now };
  return { enabled, minDisplay: min };
}

/** Test/ops: töm cachen så nästa läsning går mot databasen. */
export function clearAttendeesDisplayCache() {
  cached = null;
}
