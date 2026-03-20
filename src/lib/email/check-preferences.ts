import { createAdminClient } from "@/lib/supabase/admin";

type NotifKey =
  | "notif_booking_new"
  | "notif_booking_confirmed"
  | "notif_booking_canceled"
  | "notif_payout"
  | "notif_marketing";

/**
 * Check if a user has opted in to a specific email notification type.
 * Returns true (send) by default if no settings row exists.
 */
export async function shouldSendEmail(
  userId: string,
  notifKey: NotifKey
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Default to true if no settings exist (opt-out model)
  if (!data) return true;

  const value = (data as Record<string, unknown>)[notifKey];
  return value !== false;
}
