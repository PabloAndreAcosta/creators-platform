import { createAdminClient } from "@/lib/supabase/admin";
import type { SignupFacts } from "./rules";
import type { VolunteerRole } from "./roles";

/**
 * Inläsning för taxipassen. Allt via service-role: tabellerna är stängda för
 * webbläsaren, och den som anropar har redan kontrollerat vem som frågar.
 */

export interface Evening {
  id: string;
  title: string;
  slug: string | null;
  event_date: string;
  event_time: string | null;
  user_id: string;
  series_id: string | null;
  /** Ingen bokad DJ — då får en DJ ta pass som volontär. */
  is_practica: boolean;
}

export interface ShiftRow {
  /** Arrangörens kostnad per person, öre. 0 = volontärpass. */
  pay_ore: number;
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  role: VolunteerRole;
  role_label: string | null;
  booked: number;
}

export async function loadEvening(listingId: string): Promise<Evening | null> {
  const { data } = await createAdminClient()
    .from("listings")
    .select("id, title, slug, event_date, event_time, user_id, series_id, is_practica")
    .eq("id", listingId)
    .maybeSingle();
  if (!data?.event_date) return null;
  return { ...data, event_date: String(data.event_date).slice(0, 10) } as Evening;
}

export async function loadShifts(listingId: string): Promise<ShiftRow[]> {
  const db = createAdminClient();
  const { data: shifts } = await db
    .from("taxi_shifts")
    .select("id, starts_at, ends_at, capacity, role, role_label, pay_ore")
    .eq("listing_id", listingId)
    .order("starts_at");
  const ids = (shifts ?? []).map((s) => s.id);
  const { data: booked } = ids.length
    ? await db.from("taxi_signups").select("shift_id").in("shift_id", ids).eq("status", "booked")
    : { data: [] as { shift_id: string }[] };
  const count = new Map<string, number>();
  for (const b of booked ?? []) count.set(b.shift_id, (count.get(b.shift_id) ?? 0) + 1);
  return (shifts ?? []).map((s) => ({ ...s, role: s.role as VolunteerRole, booked: count.get(s.id) ?? 0 }));
}

/**
 * Varningsunderlaget för en dansare hos en arrangör. "Samma ställe" betyder
 * samma serie när kvällen hör till en (The Lab), annars samma arrangör.
 */
export async function loadStrikeFacts(dancerId: string, evening: Pick<Evening, "series_id" | "user_id">): Promise<SignupFacts[]> {
  const { data } = await createAdminClient()
    .from("taxi_signups")
    .select("status, late_cancel, cancelled_at, checked_in_at, shift:taxi_shifts(ends_at, listing:listings(series_id, user_id))")
    .eq("dancer_id", dancerId);
  type Row = {
    status: "booked" | "cancelled";
    late_cancel: boolean;
    cancelled_at: string | null;
    checked_in_at: string | null;
    shift: { ends_at: string; listing: { series_id: string | null; user_id: string } | null } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => {
      const l = r.shift?.listing;
      if (!l) return false;
      return evening.series_id ? l.series_id === evening.series_id : l.user_id === evening.user_id;
    })
    .map((r) => ({
      status: r.status,
      late_cancel: r.late_cancel,
      cancelled_at: r.cancelled_at,
      checked_in_at: r.checked_in_at,
      ends_at: r.shift!.ends_at,
    }));
}

/** Kommande kvällar som har minst ett taxipass. */
export async function loadUpcomingEvenings(today: string): Promise<(Evening & { shifts: ShiftRow[] })[]> {
  const db = createAdminClient();
  const { data: shifts } = await db.from("taxi_shifts").select("listing_id").gte("ends_at", new Date().toISOString());
  const ids = [...new Set((shifts ?? []).map((s) => s.listing_id))];
  if (ids.length === 0) return [];
  const { data: listings } = await db
    .from("listings")
    .select("id, title, slug, event_date, event_time, user_id, series_id, is_practica")
    .in("id", ids)
    .gte("event_date", today)
    .order("event_date");
  return Promise.all(
    (listings ?? []).map(async (l) => ({
      ...(l as Evening),
      event_date: String(l.event_date).slice(0, 10),
      shifts: await loadShifts(l.id),
    })),
  );
}

export interface PublicTaxiDancer {
  firstName: string;
  avatarUrl: string | null;
  /** Passens tider, "17:00–19:00", i ordning. */
  times: string[];
}

/**
 * Kvällens bokade taxidansare för den publika evenemangssidan: bara förnamn,
 * och bara de som inte kryssat ur show_on_event vid anmälan.
 */
export async function loadPublicTaxiDancers(listingId: string): Promise<PublicTaxiDancer[]> {
  const db = createAdminClient();
  const { data: shifts } = await db
    .from("taxi_shifts")
    .select("id, starts_at, ends_at")
    .eq("listing_id", listingId)
    .eq("role", "taxi_dancer")
    .order("starts_at");
  if (!shifts?.length) return [];
  const { data: signups } = await db
    .from("taxi_signups")
    .select("shift_id, dancer_id")
    .in("shift_id", shifts.map((s) => s.id))
    .eq("status", "booked")
    .eq("show_on_event", true);
  if (!signups?.length) return [];
  const ids = [...new Set(signups.map((s) => s.dancer_id))];
  const { data: profiles } = await db.from("profiles").select("id, full_name, avatar_url").in("id", ids);
  const hm = (iso: string) =>
    new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" }).format(new Date(iso));
  return ids
    .map((id) => {
      const p = (profiles ?? []).find((x) => x.id === id);
      const first = (p?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
      // Namn i versaler från BankID ("DANIEL") blir "Daniel".
      const firstName = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
      const times = shifts
        .filter((sh) => signups.some((s) => s.dancer_id === id && s.shift_id === sh.id))
        .map((sh) => `${hm(sh.starts_at)}–${hm(sh.ends_at)}`);
      return { firstName, avatarUrl: p?.avatar_url ?? null, times };
    })
    .filter((d) => d.firstName);
}
