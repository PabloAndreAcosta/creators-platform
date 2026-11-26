import type { createAdminClient } from "@/lib/supabase/admin";
import { validateShift } from "@/lib/taxi/rules";
import { parseVolunteerRole, volunteerRoleAllowed } from "@/lib/taxi/roles";
import { isCancelled } from "@/lib/entrance/door-link";
import { utcToStockholmLocal } from "@/lib/time";

/**
 * Nya kvällar i en serie ärver seriens volontärpass.
 *
 * Passen läggs upp med "hela serien", men det gäller bara kvällar som redan
 * finns. När The Lab fick fyra nya torsdagar 10 nov fick de inga pass, och
 * usha.se/taxi visade "Inga kvällar söker volontärer" på kvällen 26 nov.
 *
 * Varje natt får en ny, publicerad kväll utan ett enda pass samma pass som
 * seriens senaste kväll med pass (samma väggklocka, roll, platser och ersättning).
 * Bara kvällar skapade de senaste dagarna rörs, så en arrangör som medvetet
 * tagit bort alla pass på en kväll inte får tillbaka dem nästa natt. Utkast
 * (is_active = false) väntar, eftersom ett duplicerat utkast först får sitt
 * riktiga datum när ägaren sparar det.
 */

/** Hur långt bak en ny kväll räknas som ny. Tål att jobbet missar ett par nätter. */
export const INHERIT_WINDOW_DAYS = 3;

export interface TemplateShift {
  role: string;
  role_label: string | null;
  capacity: number;
  pay_ore: number;
  created_by: string;
  starts_at: string;
  ends_at: string;
}

export interface NewEvening {
  id: string;
  event_date: string;
  is_practica: boolean;
}

export interface ShiftInsert {
  listing_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  role: string;
  role_label: string | null;
  pay_ore: number;
  created_by: string;
}

const clock = (iso: string) => utcToStockholmLocal(iso).slice(11, 16);

/** Mallens pass flyttade till den nya kvällens datum, med samma regler som när ett pass läggs upp. */
export function planInheritedShifts(evening: NewEvening, template: TemplateShift[]): ShiftInsert[] {
  const rows: ShiftInsert[] = [];
  const seen = new Set<string>();
  for (const s of template) {
    const role = parseVolunteerRole(s.role);
    if (!role || !volunteerRoleAllowed(role, evening, s.pay_ore)) continue;
    const r = validateShift({
      eventDate: evening.event_date,
      startTime: clock(s.starts_at),
      endTime: clock(s.ends_at),
      capacity: s.capacity,
      role,
    });
    if (!r.ok) continue;
    const key = `${role}|${s.role_label ?? ""}|${r.startsAt}|${r.endsAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      listing_id: evening.id,
      starts_at: r.startsAt,
      ends_at: r.endsAt,
      capacity: s.capacity,
      role,
      role_label: s.role_label,
      pay_ore: s.pay_ore,
      created_by: s.created_by,
    });
  }
  return rows;
}

type Db = ReturnType<typeof createAdminClient>;

/** Ger nya seriekvällar utan pass seriens pass. Returnerar antalet kvällar och pass som lades upp. */
export async function inheritSeriesShifts(
  db: Db,
  opts: { today: string; now?: Date },
): Promise<{ evenings: number; shifts: number }> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - INHERIT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: fresh, error } = await db
    .from("listings")
    .select("id, title, event_date, is_practica, series_id, user_id")
    .not("series_id", "is", null)
    .eq("is_active", true)
    .gte("event_date", opts.today)
    .gte("created_at", since);
  if (error) throw error;
  const candidates = (fresh ?? []).filter((l) => l.event_date && !isCancelled(l.title ?? ""));
  if (candidates.length === 0) return { evenings: 0, shifts: 0 };

  const { data: existing, error: exErr } = await db
    .from("taxi_shifts")
    .select("listing_id")
    .in("listing_id", candidates.map((l) => l.id));
  if (exErr) throw exErr;
  const hasShifts = new Set((existing ?? []).map((s) => s.listing_id));
  const bare = candidates.filter((l) => !hasShifts.has(l.id));

  let evenings = 0;
  let shifts = 0;
  const templates = new Map<string, TemplateShift[]>();
  for (const l of bare) {
    const key = `${l.series_id}|${l.user_id}`;
    if (!templates.has(key)) templates.set(key, await loadTemplate(db, l.series_id, l.user_id));
    const rows = planInheritedShifts(
      { id: l.id, event_date: String(l.event_date).slice(0, 10), is_practica: !!l.is_practica },
      templates.get(key)!,
    );
    if (rows.length === 0) continue;
    const { error: insErr } = await db.from("taxi_shifts").insert(rows);
    if (insErr) throw insErr;
    evenings++;
    shifts += rows.length;
  }
  return { evenings, shifts };
}

/** Passen på seriens senaste kväll som har pass (samma ägare). Tom lista = serien har inga pass. */
async function loadTemplate(db: Db, seriesId: string, userId: string): Promise<TemplateShift[]> {
  const { data: siblings } = await db
    .from("listings")
    .select("id, title, event_date")
    .eq("series_id", seriesId)
    .eq("user_id", userId)
    .order("event_date", { ascending: false });
  const ids = (siblings ?? []).filter((s) => !isCancelled(s.title ?? "")).map((s) => s.id);
  if (ids.length === 0) return [];
  const { data: all } = await db
    .from("taxi_shifts")
    .select("listing_id, role, role_label, capacity, pay_ore, created_by, starts_at, ends_at")
    .in("listing_id", ids);
  for (const id of ids) {
    const own = (all ?? []).filter((s) => s.listing_id === id);
    if (own.length > 0) return own as TemplateShift[];
  }
  return [];
}
