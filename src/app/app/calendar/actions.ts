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
