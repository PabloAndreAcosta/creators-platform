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

  const { data: product, error } = await supabase
    .from("digital_products")
    .insert({
      creator_id: user.id,
      title,
      description,
      price,
      product_type,
    } as any)
    .select("id")
    .single();

  if (error || !product) return { error: "Kunde inte skapa produkt" };

  // Content URL lives in the gated content table, never on the public row.
  if (video_url) {
    await supabase
      .from("digital_product_content")
      .insert({ product_id: product.id, video_url } as any);
  }

  revalidatePath("/dashboard/products");
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

  if (error) return { error: "Kunde inte ta bort produkt" };

  revalidatePath("/dashboard/products");
  return { success: true };
}
