import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Kvällens taxidansare och instruktörer, för publika ytor: evenemangssidan,
 * serielistan och kalendern. Den som kommer för att träna ska se vem som är
 * där utan att öppna kvällen.
 *
 * Bara den som själv anmält sig syns. Källor: bokade volontärpass i rollerna
 * taxidansare och instruktör, och instruktörer som gått med på kvällen för att
 * sälja minuter (event_instructors — de är redan publika på kvällens sida),
 * och medverkande som själva valt att vara med kvällen (listing_collaborators.attending).
 * Förnamnet visas alltid (det hör till rollen); bilden bara om personen inte
 * valt bort den vid anmälan (show_photo_on_event).
 */
export type CrewRole = "taxi_dancer" | "instructor" | "collaborator";

export interface CrewMember {
  firstName: string;
  avatarUrl: string | null;
  role: CrewRole;
  /** Passtider "17:00–19:00" i ordning; tom för instruktör utan pass. */
  times: string[];
}

const CREW_ROLES: CrewRole[] = ["taxi_dancer", "instructor", "collaborator"];
const SHIFT_ROLES = ["taxi_dancer", "instructor"];

export function firstNameOf(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  // Namn i versaler från BankID ("DANIEL") blir "Daniel".
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}

const hm = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" }).format(
    new Date(iso),
  );

/** Besättning per kväll. Kvällar utan någon saknas i kartan. */
export async function loadEveningCrew(listingIds: string[]): Promise<Map<string, CrewMember[]>> {
  const out = new Map<string, CrewMember[]>();
  const ids = [...new Set(listingIds.filter(Boolean))];
  if (!ids.length) return out;
  const db = createAdminClient();

  const [{ data: shifts }, { data: joined }, { data: collabs }] = await Promise.all([
    db.from("taxi_shifts").select("id, listing_id, role, starts_at, ends_at").in("listing_id", ids).in("role", SHIFT_ROLES).order("starts_at"),
    db.from("event_instructors").select("listing_id, instructor_id").in("listing_id", ids),
    // Medverkande syns bara de kvällar de själva valt att vara med (attending).
    db.from("listing_collaborators").select("listing_id, user_id").in("listing_id", ids).eq("status", "accepted").eq("attending", true),
  ]);
  const collabRows = (collabs ?? []) as { listing_id: string; user_id: string }[];
  const shiftIds = (shifts ?? []).map((s) => s.id);
  const { data: signups } = shiftIds.length
    ? await db.from("taxi_signups").select("shift_id, dancer_id, show_photo_on_event").in("shift_id", shiftIds).eq("status", "booked")
    : { data: [] as { shift_id: string; dancer_id: string; show_photo_on_event: boolean }[] };
  const signupRows = (signups ?? []) as { shift_id: string; dancer_id: string; show_photo_on_event: boolean }[];
  // Har personen valt bort bilden på något pass gäller det hela kvällen.
  const noPhoto = new Set(signupRows.filter((s) => !s.show_photo_on_event).map((s) => s.dancer_id));
  const joinedRows = (joined ?? []) as { listing_id: string; instructor_id: string }[];

  const people = [...new Set([...signupRows.map((s) => s.dancer_id), ...joinedRows.map((j) => j.instructor_id), ...collabRows.map((c) => c.user_id)])];
  if (!people.length) return out;
  const { data: profiles } = await db.from("profiles").select("id, full_name, avatar_url").in("id", people);
  const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));

  // listing → (person|roll) → medlem
  const byListing = new Map<string, Map<string, CrewMember>>();
  const add = (listingId: string, personId: string, role: CrewRole, time?: string) => {
    const p = profileOf.get(personId);
    const firstName = firstNameOf(p?.full_name);
    if (!firstName) return;
    const m = byListing.get(listingId) ?? new Map<string, CrewMember>();
    byListing.set(listingId, m);
    const key = `${personId}|${role}`;
    const avatarUrl = noPhoto.has(personId) ? null : (p?.avatar_url ?? null);
    const cur: CrewMember = m.get(key) ?? { firstName, avatarUrl, role, times: [] };
    if (time && !cur.times.includes(time)) cur.times.push(time);
    m.set(key, cur);
  };
  const shiftOf = new Map((shifts ?? []).map((s) => [s.id, s]));
  for (const s of signupRows) {
    const sh = shiftOf.get(s.shift_id);
    if (sh) add(sh.listing_id, s.dancer_id, sh.role as CrewRole, `${hm(sh.starts_at)}–${hm(sh.ends_at)}`);
  }
  for (const j of joinedRows) add(j.listing_id, j.instructor_id, "instructor");
  for (const c of collabRows) add(c.listing_id, c.user_id, "collaborator");

  for (const [listingId, m] of byListing) {
    // Taxidansare först, sedan instruktörer.
    out.set(listingId, [...m.values()].sort((a, b) => CREW_ROLES.indexOf(a.role) - CREW_ROLES.indexOf(b.role)));
  }
  return out;
}
