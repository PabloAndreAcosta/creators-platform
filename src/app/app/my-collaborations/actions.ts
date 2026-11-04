"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Medverkande väljer själv om hen är med en viss kväll. Bara då syns hen på
 * kvällens sida, i serien, kalendern och på korten. Bara den egna raden.
 */
export async function setAttending(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const listingId = String(formData.get("listingId") ?? "");
  const attending = formData.get("attending") === "yes";
  const { error } = await createAdminClient()
    .from("listing_collaborators")
    .update({ attending })
    .eq("listing_id", listingId)
    .eq("user_id", user.id)
    .eq("status", "accepted");
  if (error) throw error;
  revalidatePath("/app/my-collaborations");
}
