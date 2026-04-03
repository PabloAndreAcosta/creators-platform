"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
