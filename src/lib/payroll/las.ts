/**
 * Anställningstid enligt LAS för kreatörer som anställs per pass.
 *
 * Varje pass är en egen särskild visstidsanställning. Två regler gör att det
 * ändå kan bli en tillsvidareanställning utan att någon bestämt det:
 *
 *   LAS 3 § — har någon tre eller fler särskilda visstidsanställningar under
 *   samma kalendermånad räknas även tiden MELLAN dem som anställningstid.
 *   Fyra torsdagar i oktober blir då nästan hela oktober.
 *
 *   LAS 5 a § — överstiger tiden i särskild visstid sammanlagt 12 månader
 *   inom en femårsperiod övergår anställningen till en tillsvidareanställning.
 *
 * Det här är inget man kan avtala bort utan kollektivavtal (LAS 2 a–2 b §§).
 * Plattformen måste därför RÄKNA tiden och varna i god tid, så att ett beslut
 * fattas av en människa i stället för att uppstå av sig självt en torsdag.
 *
 * Förenklingar, medvetna: 12 månader räknas som 365 dagar, och "följd av
 * anställningar" (tillträde inom 6 månader) behandlas inte separat eftersom
 * femårsfönstret redan fångar en kreatör som återkommer regelbundet.
 */

const DAY_MS = 86_400_000;
const LIMIT_DAYS = 365;
const WINDOW_DAYS = 5 * 365;

/** Varna när så här många dagar återstår till gränsen. */
export const LAS_WARN_DAYS_LEFT = 60;

export interface LasStatus {
  /** Räknade anställningsdagar inom femårsfönstret. */
  days: number;
  daysLeft: number;
  level: "ok" | "warn" | "limit";
}

function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/**
 * @param passDates ISO-datum för genomförda pass, i valfri ordning.
 * @param today ISO-datum som fönstret räknas bakåt från.
 */
export function lasStatus(passDates: string[], today: string): LasStatus {
  const end = toDay(today);
  const start = end - WINDOW_DAYS + 1;
  const days = new Set<number>();

  const byMonth = new Map<string, number[]>();
  for (const d of passDates) {
    const day = toDay(d);
    if (Number.isNaN(day)) throw new Error(`Ogiltigt datum: ${d}`);
    if (day < start || day > end) continue;
    const key = d.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(day);
    byMonth.set(key, list);
  }

  for (const list of byMonth.values()) {
    list.sort((a, b) => a - b);
    if (list.length >= 3) {
      // 3 §: från första till sista passet i månaden räknas allt.
      for (let x = list[0]; x <= list[list.length - 1]; x++) days.add(x);
    } else {
      for (const x of list) days.add(x);
    }
  }

  const count = days.size;
  const daysLeft = LIMIT_DAYS - count;
  const level = count > LIMIT_DAYS ? "limit" : daysLeft <= LAS_WARN_DAYS_LEFT ? "warn" : "ok";
  return { days: count, daysLeft, level };
}
