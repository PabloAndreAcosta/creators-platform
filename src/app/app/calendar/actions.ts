"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  validateCommitment,
  COMMITMENT_COLUMNS,
  COMMITMENT_ERROR_SV,
  COMMITMENT_DAY_BLOCKED_SV,
  COMMITMENT_LIMITS,
  type Commitment,
  type CommitmentErrorCode,
  type CommitmentInput,
  type CommitmentKind,
} from "@/lib/calendar/commitments";
import {
  validateCalendarIcsUrl,
  maskCalendarUrl,
  parseIcs,
  upcomingEvents,
  guessCommitmentKind,
} from "@/lib/calendar/ics-import";
import { fetchCalendarIcs, type IcsFetchError } from "@/lib/calendar/ics-fetch";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Ligger datumet inom något av användarens egna åtaganden? Då får dagen inte
 * markeras som bokningsbar. Ett fel i uppslaget spärrar inte — tillgänglighet
 * ska inte bli omöjlig att sätta för att tabellen inte svarar.
 */
async function isDateBlockedByCommitment(supabase: SupabaseServer, userId: string, date: string) {
  const { data, error } = await supabase
    .from("creator_commitments")
    .select("id")
    .eq("user_id", userId)
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);
  if (error) {
    console.error("[calendar] kunde inte läsa åtaganden:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Generate or regenerate the user's calendar sync token.
 * Returns the full subscription URL.
 */
export async function generateCalendarSyncToken() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const token = crypto.randomUUID();

  const { error } = await supabase
    .from("profiles")
    .update({ calendar_sync_token: token } as any)
    .eq("id", user.id);

  if (error) {
    return { error: "Kunde inte skapa synk-token." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const feedUrl = `${baseUrl}/api/calendar/feed?token=${token}`;

  revalidatePath("/app/calendar");
  return { feedUrl };
}

/**
 * Revoke the user's calendar sync token.
 */
export async function revokeCalendarSyncToken() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("profiles")
    .update({ calendar_sync_token: null } as any)
    .eq("id", user.id);

  if (error) {
    return { error: "Kunde inte ta bort synk-token." };
  }

  revalidatePath("/app/calendar");
  return { success: true };
}

/**
 * Toggle availability for a specific date (all-day).
 * If already available, removes all slots for that date. Otherwise, adds all-day.
 */
export async function toggleAvailability(date: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { data: existing } = await supabase
    .from("creator_availability")
    .select("id")
    .eq("user_id", user.id)
    .eq("available_date", date);

  if (existing && existing.length > 0) {
    // Remove all slots for this date
    await supabase
      .from("creator_availability")
      .delete()
      .eq("user_id", user.id)
      .eq("available_date", date);
    revalidatePath("/app/calendar");
    return { available: false };
  } else {
    if (await isDateBlockedByCommitment(supabase, user.id, date)) {
      return { error: COMMITMENT_DAY_BLOCKED_SV, code: "dayBlocked" as const };
    }
    const { error } = await supabase
      .from("creator_availability")
      .insert({ user_id: user.id, available_date: date });
    if (error) return { error: "Kunde inte spara tillgänglighet" };
    revalidatePath("/app/calendar");
    return { available: true };
  }
}

/**
 * Add a specific time slot on a date.
 */
export async function addTimeSlot(date: string, startTime: string, endTime: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };
  if (!startTime || !endTime) return { error: "Start- och sluttid krävs" };
  if (endTime <= startTime) return { error: "Sluttid måste vara efter starttid" };
  if (await isDateBlockedByCommitment(supabase, user.id, date)) {
    return { error: COMMITMENT_DAY_BLOCKED_SV, code: "dayBlocked" as const };
  }

  // Check for overlapping slots
  const { data: existing } = await supabase
    .from("creator_availability")
    .select("id, start_time, end_time")
    .eq("user_id", user.id)
    .eq("available_date", date);

  if (existing) {
    for (const slot of existing) {
      // Remove all-day entry if adding specific slot
      if (!slot.start_time && !slot.end_time) {
        await supabase.from("creator_availability").delete().eq("id", slot.id);
        continue;
      }
      // Check overlap
      if (slot.start_time && slot.end_time) {
        if (startTime < slot.end_time && endTime > slot.start_time) {
          return { error: "Tidsluckan överlappar med en befintlig" };
        }
      }
    }
  }

  const { error } = await supabase
    .from("creator_availability")
    .insert({
      user_id: user.id,
      available_date: date,
      start_time: startTime,
      end_time: endTime,
    });

  if (error) return { error: "Kunde inte lägga till tidslucka" };

  revalidatePath("/app/calendar");
  return { success: true };
}

/**
 * Remove a specific time slot.
 */
export async function removeTimeSlot(slotId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("creator_availability")
    .delete()
    .eq("id", slotId)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte ta bort tidslucka" };

  revalidatePath("/app/calendar");
  return { success: true };
}

/**
 * Get time slots for a specific date and creator.
 */
export async function getTimeSlotsForDate(date: string, userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("creator_availability")
    .select("id, start_time, end_time")
    .eq("user_id", userId)
    .eq("available_date", date)
    .order("start_time", { ascending: true });

  return { slots: data || [] };
}

/**
 * Get availability dates for a user in a specific month.
 */
export async function getAvailability(year: number, month: number, userId?: string) {
  const supabase = await createClient();

  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id;
  }
  if (!uid) return { dates: [] as string[] };

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data } = await supabase
    .from("creator_availability")
    .select("id, available_date, start_time, end_time")
    .eq("user_id", uid)
    .gte("available_date", startDate)
    .lte("available_date", endDate)
    .order("start_time", { ascending: true });

  const rows = data || [];
  const dateSet = new Set(rows.map((r) => r.available_date));
  const slots: Record<string, { id: string; start_time: string | null; end_time: string | null }[]> = {};
  for (const row of rows) {
    if (!slots[row.available_date]) slots[row.available_date] = [];
    slots[row.available_date].push({ id: row.id, start_time: row.start_time, end_time: row.end_time });
  }

  return { dates: Array.from(dateSet), slots };
}

// ─── Egna åtaganden ───
// Privata: festivaler, dansjobb, kurser m.m. som användaren själv går på eller
// jobbar på. De visas bara i den egna kalendern och ingår INTE i iCal-flödet
// (/api/calendar/feed) — användarens egen kalender är redan källan.

type CommitmentResult =
  | { commitment: Commitment; availabilityOverlap: number }
  | { error: string; code?: CommitmentErrorCode | "alreadyImported" };

/** Antal dagar med tillgänglighet som redan ligger inom intervallet. */
async function countAvailabilityInRange(supabase: SupabaseServer, userId: string, start: string, end: string) {
  const { data } = await supabase
    .from("creator_availability")
    .select("available_date")
    .eq("user_id", userId)
    .gte("available_date", start)
    .lte("available_date", end);
  return new Set((data || []).map((r) => r.available_date)).size;
}

export async function addCommitment(input: CommitmentInput): Promise<CommitmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const parsed = validateCommitment(input);
  if (!parsed.ok) return { error: COMMITMENT_ERROR_SV[parsed.code], code: parsed.code };

  const { data, error } = await supabase
    .from("creator_commitments")
    .insert({
      ...parsed.value,
      user_id: user.id,
      source: parsed.value.external_uid ? "google" : "manual",
    })
    .select(COMMITMENT_COLUMNS)
    .single();
  if (error?.code === "23505") return { error: "Händelsen är redan tillagd", code: "alreadyImported" };
  if (error || !data) return { error: "Kunde inte spara åtagandet" };

  const availabilityOverlap = await countAvailabilityInRange(
    supabase,
    user.id,
    parsed.value.start_date,
    parsed.value.end_date
  );

  revalidatePath("/app/calendar");
  return { commitment: data as unknown as Commitment, availabilityOverlap };
}

/**
 * Sparar om ett åtagande, t.ex. när beloppen fylls i efteråt. Källan och
 * kalender-UID:t ändras aldrig härifrån — de hör till importen.
 */
export async function updateCommitment(id: string, input: CommitmentInput): Promise<CommitmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };
  if (typeof id !== "string" || !id) return { error: "Åtagandet hittades inte" };

  const parsed = validateCommitment({ ...input, external_uid: null });
  if (!parsed.ok) return { error: COMMITMENT_ERROR_SV[parsed.code], code: parsed.code };
  const values: Omit<typeof parsed.value, "external_uid"> & { external_uid?: string | null } = { ...parsed.value };
  delete values.external_uid;

  const { data, error } = await supabase
    .from("creator_commitments")
    .update(values)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(COMMITMENT_COLUMNS)
    .maybeSingle();
  if (error) return { error: "Kunde inte spara åtagandet" };
  if (!data) return { error: "Åtagandet hittades inte" };

  const availabilityOverlap = await countAvailabilityInRange(supabase, user.id, values.start_date, values.end_date);

  revalidatePath("/app/calendar");
  return { commitment: data as unknown as Commitment, availabilityOverlap };
}

export async function deleteCommitment(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };
  if (typeof id !== "string" || !id) return { error: "Åtagandet hittades inte" };

  const { error } = await supabase
    .from("creator_commitments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Kunde inte ta bort åtagandet" };

  revalidatePath("/app/calendar");
  return { success: true };
}

// ─── Import från Google Kalender (hemlig iCal-adress) ───
// Adressen är en bärarnyckel till hela användarens kalender. Den läses och
// skrivs bara med service-role efter getUser(), som calendar_sync_token, och
// skickas aldrig tillbaka till klienten annat än maskerad. Den loggas aldrig.

export type CalendarImportErrorCode = "invalidUrl" | "notConnected" | "rateLimited" | "saveFailed" | IcsFetchError;

export async function saveExternalCalendarUrl(rawUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const checked = validateCalendarIcsUrl(rawUrl);
  if (!checked.ok) {
    return { error: "Adressen måste vara kalenderns hemliga iCal-adress från calendar.google.com", code: "invalidUrl" as const };
  }

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ external_calendar_ics_url: checked.url } as never)
    .eq("id", user.id);
  if (error) return { error: "Kunde inte spara adressen", code: "saveFailed" as const };

  revalidatePath("/app/calendar");
  return { masked: maskCalendarUrl(checked.url) };
}

export async function removeExternalCalendarUrl() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ external_calendar_ics_url: null } as never)
    .eq("id", user.id);
  if (error) return { error: "Kunde inte ta bort adressen", code: "saveFailed" as const };

  revalidatePath("/app/calendar");
  return { success: true };
}

export interface CalendarSuggestion {
  uid: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string | null;
  kind: CommitmentKind;
}

type FetchCalendarResult =
  | { suggestions: CalendarSuggestion[]; refreshed: Commitment[] }
  | { error: string; code: CalendarImportErrorCode };

/**
 * Hämtar den kopplade kalendern och ger tillbaka FÖRSLAG — inget läggs in
 * automatiskt. Åtaganden som redan importerats (source 'google') får titel,
 * datum och plats uppdaterade från kalendern; ekonomi, syfte, roll och
 * anteckning rörs aldrig.
 */
export async function fetchExternalCalendar(): Promise<FetchCalendarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad", code: "notConnected" };

  if (!rateLimit(`calendar-import:${user.id}`, 6, 60_000).allowed) {
    return { error: "Vänta en stund innan du hämtar igen", code: "rateLimited" };
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("external_calendar_ics_url")
    .eq("id", user.id)
    .single();
  const url = (profile as { external_calendar_ics_url?: string | null } | null)?.external_calendar_ics_url;
  if (!url) return { error: "Ingen kalender kopplad", code: "notConnected" };

  const fetched = await fetchCalendarIcs(url);
  if (!fetched.ok) {
    // Bara felkoden loggas — aldrig adressen.
    console.warn("[calendar-import] hämtning misslyckades:", fetched.error, fetched.status ?? "");
    return { error: "Kunde inte hämta kalendern", code: fetched.error };
  }

  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
  const events = upcomingEvents(parseIcs(fetched.text), today, 18);

  const [{ data: imported }, { data: hidden }] = await Promise.all([
    supabase
      .from("creator_commitments")
      .select(COMMITMENT_COLUMNS)
      .eq("user_id", user.id)
      .eq("source", "google"),
    supabase.from("calendar_import_hidden").select("external_uid").eq("user_id", user.id),
  ]);
  const importedByUid = new Map(
    ((imported || []) as unknown as Commitment[]).filter((c) => c.external_uid).map((c) => [c.external_uid!, c])
  );
  const hiddenUids = new Set((hidden || []).map((h) => h.external_uid));

  const suggestions: CalendarSuggestion[] = [];
  const refreshed: Commitment[] = [];

  for (const event of events) {
    const title = event.summary.slice(0, COMMITMENT_LIMITS.title).trim();
    const location = event.location ? event.location.slice(0, COMMITMENT_LIMITS.location) : null;
    const existing = importedByUid.get(event.uid);

    if (existing) {
      const patch: Partial<Pick<Commitment, "title" | "start_date" | "end_date" | "location">> = {};
      if (title && title !== existing.title) patch.title = title;
      if (event.startDate !== existing.start_date) patch.start_date = event.startDate;
      if (event.endDate !== existing.end_date) patch.end_date = event.endDate;
      if (location !== existing.location) patch.location = location;
      if (Object.keys(patch).length) {
        const { data: updated } = await supabase
          .from("creator_commitments")
          .update(patch)
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select(COMMITMENT_COLUMNS)
          .maybeSingle();
        if (updated) refreshed.push(updated as unknown as Commitment);
      }
      continue;
    }

    if (hiddenUids.has(event.uid) || event.uid.length > COMMITMENT_LIMITS.externalUid) continue;
    suggestions.push({
      uid: event.uid,
      title,
      start_date: event.startDate,
      end_date: event.endDate,
      location,
      kind: guessCommitmentKind(title),
    });
    if (suggestions.length >= 200) break;
  }

  if (refreshed.length) revalidatePath("/app/calendar");
  return { suggestions, refreshed };
}

/** Döljer ett förslag så att det inte kommer tillbaka vid nästa hämtning. */
export async function hideCalendarSuggestion(uid: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };
  if (typeof uid !== "string" || !uid || uid.length > COMMITMENT_LIMITS.externalUid) {
    return { error: "Ogiltig kalenderhändelse" };
  }

  const { error } = await supabase
    .from("calendar_import_hidden")
    .upsert({ user_id: user.id, external_uid: uid }, { onConflict: "user_id,external_uid", ignoreDuplicates: true });
  if (error) return { error: "Kunde inte dölja förslaget" };
  return { success: true };
}
