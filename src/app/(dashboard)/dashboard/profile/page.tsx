import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProfileForm from "./profile-form";
import { MediaGallery } from "./media-gallery";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: media }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, bio, website, category, location, hourly_rate, is_public, categories, locations, rates, websites, social_instagram, social_x, social_facebook, contact_email, contact_phone, role, tier, whitelabel_enabled, whitelabel_brand_name, whitelabel_logo_url, whitelabel_primary_color, whitelabel_accent_color, whitelabel_accent_color_2, whitelabel_accent_color_3")
      .eq("id", user.id)
      .single(),
    supabase
      .from("creator_media")
      .select("id, media_type, url, thumbnail_url, caption, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!profile) {
    redirect("/dashboard");
  }

  const isCreator = profile.role === "creator" || profile.role === "experience" || profile.role === "kreator" || profile.role === "upplevelse";

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Redigera profil</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Uppdatera din information och gör din profil synlig för kunder.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <ProfileForm profile={profile} isPaidTier={profile.tier === 'guld' || profile.tier === 'premium'} isPremium={profile.tier === 'premium'} />
      </div>

      {isCreator && (
        <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
          <MediaGallery userId={user.id} initialMedia={media || []} />
        </div>
      )}
    </>
  );
}
