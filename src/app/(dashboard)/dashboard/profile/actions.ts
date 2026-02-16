"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CATEGORIES = ["dance", "music", "photo", "video", "design", "yoga", "fitness", "other"] as const;

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
  const category = formData.get("category") as string;
  const location = formData.get("location") as string;
  const website = formData.get("website") as string;
  const hourly_rate_raw = formData.get("hourly_rate") as string;
  const is_public = formData.get("is_public") === "on";

  const hourly_rate = hourly_rate_raw ? parseInt(hourly_rate_raw, 10) : null;

  if (category && !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: "Ogiltig kategori" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name || null,
      bio: bio || null,
      category: category || null,
      location: location || null,
      website: website || null,
      hourly_rate,
      is_public,
    })
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
