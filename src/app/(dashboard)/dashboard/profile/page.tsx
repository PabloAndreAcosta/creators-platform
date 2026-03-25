import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ProfileForm from "./profile-form";
import { MediaGallery } from "./media-gallery";
import { InstagramConnect } from "./instagram-connect";
import { FacebookMediaConnect } from "./facebook-media-connect";
import { TikTokConnect } from "./tiktok-connect";
import { BETA_MODE } from "@/lib/beta";

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
      .select("id, full_name, slug, avatar_url, bio, website, category, location, hourly_rate, is_public, categories, locations, rates, websites, social_instagram, social_x, social_facebook, contact_email, contact_phone, role, tier, whitelabel_enabled, whitelabel_brand_name, whitelabel_logo_url, whitelabel_primary_color, whitelabel_accent_color, whitelabel_accent_color_2, whitelabel_accent_color_3, instagram_user_id, instagram_username, instagram_access_token, facebook_page_id, facebook_page_name, facebook_page_access_token, tiktok_user_id, tiktok_username, tiktok_access_token")
      .eq("id", user.id)
      .single(),
    supabase
      .from("creator_media")
      .select("id, media_type, url, thumbnail_url, caption, sort_order, is_hero, section")
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Redigera profil</h1>
            <p className="mt-1 text-[var(--usha-muted)]">
              {isCreator
                ? "Uppdatera din information och gör din profil synlig för kunder."
                : "Uppdatera din profilinformation."}
            </p>
          </div>
          {profile.slug && profile.is_public && (
            <a
              href={`/creators/${profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent,var(--usha-gold))] px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-90"
            >
              <ExternalLink size={14} />
              Visa profil
            </a>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <ProfileForm profile={profile} isPaidTier={BETA_MODE || profile.tier === 'guld' || profile.tier === 'premium'} isPremium={BETA_MODE || profile.tier === 'premium'} isCustomer={!isCreator} />
      </div>

      {isCreator && (
        <>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <InstagramConnect
              isConnected={!!profile.instagram_access_token}
              instagramUsername={profile.instagram_username}
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <FacebookMediaConnect
              isConnected={!!profile.facebook_page_access_token}
              pageName={profile.facebook_page_name}
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <TikTokConnect
              isConnected={!!profile.tiktok_access_token}
              tiktokUsername={profile.tiktok_username}
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <MediaGallery userId={user.id} initialMedia={media || []} />
          </div>
        </>
      )}
    </>
  );
}
