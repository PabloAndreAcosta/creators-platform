"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = ["dance", "music", "performance", "photo", "video", "design", "yoga", "fitness", "other"] as const;

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ej inloggad" };
  }

  const full_name = formData.get("full_name") as string;
  const bio = formData.get("bio") as string;
  const is_public = formData.get("is_public") === "on";

  // Multi-value fields
  let categories: string[] = [];
  try { categories = JSON.parse(formData.get("categories") as string || "[]"); } catch { categories = []; }

  let locations: string[] = [];
  try { locations = JSON.parse(formData.get("locations") as string || "[]"); } catch { locations = []; }

  let rates: Record<string, number> = {};
  try { rates = JSON.parse(formData.get("rates") as string || "{}"); } catch { rates = {}; }

  let websites: string[] = [];
  try { websites = JSON.parse(formData.get("websites") as string || "[]"); } catch { websites = []; }

  const social_instagram = (formData.get("social_instagram") as string)?.trim() || null;
  const social_x = (formData.get("social_x") as string)?.trim() || null;
  const social_facebook = (formData.get("social_facebook") as string)?.trim() || null;
  const contact_email = (formData.get("contact_email") as string)?.trim() || null;
  const contact_phone = (formData.get("contact_phone") as string)?.trim() || null;

  // Validate categories
  categories = categories.filter((c) => VALID_CATEGORIES.includes(c as any));

  // Validate rates (only for selected categories, must be non-negative)
  const cleanRates: Record<string, number> = {};
  for (const cat of categories) {
    if (rates[cat] != null && Number.isFinite(rates[cat]) && rates[cat] >= 0) {
      cleanRates[cat] = rates[cat];
    }
  }

  // Keep backward compat: also write to legacy single-value columns
  const primaryCategory = categories[0] || null;
  const primaryLocation = locations[0] || null;
  const primaryRate = primaryCategory && cleanRates[primaryCategory] != null ? cleanRates[primaryCategory] : null;
  const primaryWebsite = websites[0] || null;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name || null,
      bio: bio || null,
      is_public,
      // New multi-value fields
      categories,
      locations,
      rates: cleanRates,
      websites,
      social_instagram,
      social_x,
      social_facebook,
      contact_email,
      contact_phone,
      // Legacy single-value fields (backward compat)
      category: primaryCategory,
      location: primaryLocation,
      hourly_rate: primaryRate,
      website: primaryWebsite,
    } as any)
    .eq("id", user.id);

  if (error) {
    return { error: "Kunde inte uppdatera profilen. Försök igen." };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAvatar(avatarUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ej inloggad" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) {
    return { error: "Kunde inte uppdatera avatar." };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { success: true };
}
