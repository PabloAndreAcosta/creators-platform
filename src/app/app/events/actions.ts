"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EVENT_CATEGORIES } from "./constants";

function parseEventForm(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = formData.get("category") as string;
  const priceRaw = formData.get("price") as string;
  const durationRaw = formData.get("duration_minutes") as string;
  const eventTier = (formData.get("event_tier") as string) || null;

  if (!title) return { error: "Titel krävs" } as const;
  if (!category || !EVENT_CATEGORIES.includes(category as (typeof EVENT_CATEGORIES)[number])) {
    return { error: "Välj en giltig kategori" } as const;
  }

  return {
    data: {
      title,
      description: description || null,
      category,
      price: priceRaw ? parseInt(priceRaw, 10) : null,
      duration_minutes: durationRaw ? parseInt(durationRaw, 10) : null,
      event_tier: eventTier || null,
    },
  } as const;
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from("listings").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) return { error: "Kunde inte skapa evenemanget. Försök igen." };

  revalidatePath("/app/events");
  redirect("/app/events");
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("listings")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte uppdatera evenemanget. Försök igen." };

  revalidatePath("/app/events");
  redirect("/app/events");
}

export async function deleteEvent(id: string) {
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

  if (error) return { error: "Kunde inte ta bort evenemanget." };

  revalidatePath("/app/events");
  return { success: true };
}

export async function toggleEventActive(id: string, isActive: boolean) {
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

  revalidatePath("/app/events");
  return { success: true };
}
