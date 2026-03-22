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
 * Toggle availability for a specific date.
 * If already available, removes it. Otherwise, adds it.
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
    .eq("available_date", date)
    .single();

  if (existing) {
    await supabase.from("creator_availability").delete().eq("id", existing.id);
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
    .select("available_date")
    .eq("user_id", uid)
    .gte("available_date", startDate)
    .lte("available_date", endDate);

  return { dates: (data || []).map((r) => r.available_date) };
}
