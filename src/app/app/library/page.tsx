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
        video_url,
        file_url,
        creator_id,
        profiles!digital_products_creator_id_fkey(full_name, avatar_url)
      )
    `)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  return <LibraryContent purchases={purchases || []} />;
}
