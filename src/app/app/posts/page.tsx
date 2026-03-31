import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MyPostsContent } from "./my-posts-content";
import { getMyPosts } from "./queries";

export default async function MyPostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileRes, listingsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, category")
      .eq("id", user.id)
      .single(),
    supabase
      .from("listings")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileRes.data;

  if (
    !profile ||
    !["creator", "kreator", "experience", "upplevelse"].includes(
      profile.role ?? ""
    )
  ) {
    redirect("/app");
  }

  const posts = await getMyPosts(user.id);

  return (
    <MyPostsContent
      profile={profile}
      listings={(listingsRes.data || []) as { id: string; title: string }[]}
      initialPosts={posts}
    />
  );
}
