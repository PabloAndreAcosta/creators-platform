"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Returns a service-role client ONLY if the current user owns the listing.
async function ownerAdmin(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .maybeSingle();
  return listing && listing.user_id === user.id ? admin : null;
}

export async function createAccessCode(listingId: string, formData: FormData) {
  const admin = await ownerAdmin(listingId);
  if (!admin) return { error: "Behörighet saknas." };

  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) return { error: "Ange en kod." };
  const label = String(formData.get("label") || "").trim() || null;
  const maxRaw = formData.get("max_uses");
  const maxUses = maxRaw && Number(maxRaw) > 0 ? Math.floor(Number(maxRaw)) : null;

  const { error } = await admin
    .from("event_access_codes")
    .insert({ listing_id: listingId, code, label, max_uses: maxUses });
  if (error) {
    return { error: error.code === "23505" ? "Koden finns redan." : "Kunde inte skapa koden." };
  }
  revalidatePath(`/app/events/${listingId}/codes`);
  return { success: true };
}

export async function toggleAccessCode(listingId: string, codeId: string, active: boolean) {
  const admin = await ownerAdmin(listingId);
  if (!admin) return;
  await admin.from("event_access_codes").update({ is_active: active }).eq("id", codeId);
  revalidatePath(`/app/events/${listingId}/codes`);
}
