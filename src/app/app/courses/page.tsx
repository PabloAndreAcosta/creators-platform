import { createClient } from "@/lib/supabase/server";
import { ContentPageContent } from "./courses-content";

export default async function ContentPage() {
  let listings: any[] = [];
  let digitalProducts: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [listingsRes, productsRes] = await Promise.all([
        supabase
          .from("listings")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("digital_products")
          .select("*, digital_purchases(id)")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      listings = listingsRes.data || [];
      digitalProducts = (productsRes.data || []).map((p: any) => ({
        ...p,
        purchase_count: p.digital_purchases?.length || 0,
      }));
    }
  } catch {
    // Continue with empty data
  }

  return (
    <ContentPageContent
      listings={listings}
      digitalProducts={digitalProducts}
    />
  );
}
