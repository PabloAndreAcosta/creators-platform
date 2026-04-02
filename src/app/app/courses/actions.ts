"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const price = parseInt(formData.get("price") as string, 10);
  const product_type = formData.get("product_type") as string;
  const video_url = (formData.get("video_url") as string)?.trim() || null;

  if (!title) return { error: "Titel krävs" };
  if (!Number.isFinite(price) || price < 0) return { error: "Ogiltigt pris" };
  if (!["video", "course", "download", "other"].includes(product_type)) {
    return { error: "Ogiltig produkttyp" };
  }

  const { error } = await supabase
    .from("digital_products")
    .insert({
      creator_id: user.id,
      title,
      description,
      price,
      product_type,
      video_url,
    } as any);

  if (error) return { error: "Kunde inte skapa material" };

  // Auto-post to feed
  const priceText = price > 0 ? ` — ${price} kr` : " — Gratis";
  await supabase.from("posts").insert({
    user_id: user.id,
    text: `Nytt onlinematerial: ${title}${priceText}. Kolla in det på min profil!`,
    image_url: null,
    listing_id: null,
  });

  revalidatePath("/app/courses");
  revalidatePath("/app");
  revalidatePath("/app/posts");
  return { success: true };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("digital_products")
    .delete()
    .eq("id", productId)
    .eq("creator_id", user.id);

  if (error) return { error: "Kunde inte ta bort material" };

  revalidatePath("/app/courses");
  return { success: true };
}
