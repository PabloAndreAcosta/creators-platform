import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LibraryContent } from "./library-content";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: purchases } = await supabase
    .from("digital_purchases")
    .select(`
      id,
      amount_paid,
      created_at,
      digital_products(
        id,
        title,
        description,
        product_type,
        creator_id,
        profiles!digital_products_creator_id_fkey(full_name, avatar_url)
      )
    `)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  // Flatten Supabase relation arrays to single objects
  const flattened = (purchases || []).map((p: any) => ({
    ...p,
    digital_products: Array.isArray(p.digital_products)
      ? { ...p.digital_products[0], profiles: Array.isArray(p.digital_products[0]?.profiles) ? p.digital_products[0].profiles[0] || null : p.digital_products[0]?.profiles }
      : p.digital_products
        ? { ...p.digital_products, profiles: Array.isArray(p.digital_products.profiles) ? p.digital_products.profiles[0] || null : p.digital_products.profiles }
        : null,
  }));

  // Content URLs live in the gated content table — fetch them for the purchased
  // products (RLS lets a buyer read content they hold a purchase for) and merge
  // back in, so the buyer keeps their Titta/Ladda ner links.
  const productIds = flattened
    .map((p) => p.digital_products?.id)
    .filter((id): id is string => !!id);
  if (productIds.length) {
    const { data: content } = await supabase
      .from("digital_product_content")
      .select("product_id, video_url, file_url")
      .in("product_id", productIds);
    const byId = new Map((content || []).map((c) => [c.product_id, c]));
    for (const p of flattened) {
      const c = p.digital_products?.id ? byId.get(p.digital_products.id) : null;
      if (p.digital_products) {
        p.digital_products.video_url = c?.video_url ?? null;
        p.digital_products.file_url = c?.file_url ?? null;
      }
    }
  }

  return <LibraryContent purchases={flattened} />;
}
