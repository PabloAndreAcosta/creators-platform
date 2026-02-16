"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const CATEGORIES = ["dance", "music", "photo", "video", "design", "yoga", "fitness", "other"] as const;

function parseListingForm(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = formData.get("category") as string;
  const priceRaw = formData.get("price") as string;
  const durationRaw = formData.get("duration_minutes") as string;

  if (!title) return { error: "Titel krävs" } as const;
  if (!category || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: "Välj en giltig kategori" } as const;
  }

  return {
    data: {
      title,
      description: description || null,
      category,
      price: priceRaw ? parseInt(priceRaw, 10) : null,
      duration_minutes: durationRaw ? parseInt(durationRaw, 10) : null,
    },
  } as const;
}

export async function createListing(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const parsed = parseListingForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from("listings").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) return { error: "Kunde inte skapa tjänsten. Försök igen." };

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  redirect("/dashboard/listings");
}

export async function updateListing(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const parsed = parseListingForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("listings")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte uppdatera tjänsten. Försök igen." };

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  redirect("/dashboard/listings");
}

export async function deleteListing(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte ta bort tjänsten." };

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleListingActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("listings")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte ändra status." };

  revalidatePath("/dashboard/listings");
  return { success: true };
}
