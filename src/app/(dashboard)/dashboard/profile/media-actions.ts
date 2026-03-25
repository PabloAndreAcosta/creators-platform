"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface AddMediaInput {
  media_type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
}

export async function addMedia(input: AddMediaInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  // Get max sort_order
  const { data: existing } = await supabase
    .from("creator_media")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("creator_media")
    .insert({
      user_id: user.id,
      media_type: input.media_type,
      url: input.url,
      thumbnail_url: input.thumbnail_url,
      caption: input.caption,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return { error: "Kunde inte spara media" };

  revalidatePath("/dashboard/profile");
  return { data };
}

export async function removeMedia(mediaId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("creator_media")
    .delete()
    .eq("id", mediaId)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte ta bort media" };

  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function importInstagramMedia(
  items: Array<{
    media_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    media_type: "image" | "video";
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };
  if (!items.length) return { error: "Inga media valda" };

  // Get max sort_order
  const { data: existing } = await supabase
    .from("creator_media")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const rows = items.map((item) => ({
    user_id: user.id,
    media_type: item.media_type,
    url: item.media_url,
    thumbnail_url: item.thumbnail_url,
    caption: item.caption,
    sort_order: nextOrder++,
  }));

  const { data, error } = await supabase
    .from("creator_media")
    .insert(rows)
    .select();

  if (error) return { error: "Kunde inte importera media" };

  revalidatePath("/dashboard/profile");
  return { data };
}

export async function importFacebookMedia(
  items: Array<{
    media_url: string;
    thumbnail_url: string | null;
    caption: string | null;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };
  if (!items.length) return { error: "Inga media valda" };

  const { data: existing } = await supabase
    .from("creator_media")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const rows = items.map((item) => ({
    user_id: user.id,
    media_type: "image",
    url: item.media_url,
    thumbnail_url: item.thumbnail_url,
    caption: item.caption,
    sort_order: nextOrder++,
  }));

  const { data, error } = await supabase
    .from("creator_media")
    .insert(rows)
    .select();

  if (error) return { error: "Kunde inte importera media" };

  revalidatePath("/dashboard/profile");
  return { data };
}

export async function getCreatorMedia(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_media")
    .select("id, media_type, url, thumbnail_url, caption, sort_order, is_hero, section")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  return data || [];
}

export async function reorderMedia(orderedIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  // Update sort_order for each item
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("creator_media")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("user_id", user.id);

    if (error) return { error: "Kunde inte ändra ordning" };
  }

  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function toggleHero(mediaId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  // Check current hero status
  const { data: item } = await supabase
    .from("creator_media")
    .select("is_hero")
    .eq("id", mediaId)
    .eq("user_id", user.id)
    .single();

  if (!item) return { error: "Media hittades inte" };

  const wasHero = item.is_hero;

  // Clear all hero flags for this user
  await supabase
    .from("creator_media")
    .update({ is_hero: false })
    .eq("user_id", user.id);

  // If it wasn't hero, set it as hero. If it was, leave all cleared (toggle off).
  if (!wasHero) {
    await supabase
      .from("creator_media")
      .update({ is_hero: true })
      .eq("id", mediaId)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function updateMediaSection(mediaId: string, section: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("creator_media")
    .update({ section: section || null })
    .eq("id", mediaId)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte uppdatera sektion" };

  revalidatePath("/dashboard/profile");
  return { success: true };
}
