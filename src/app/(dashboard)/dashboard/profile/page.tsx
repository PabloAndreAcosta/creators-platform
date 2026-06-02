import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ProfileForm from "./profile-form";
import { MediaGallery } from "./media-gallery";
import { InstagramConnect } from "./instagram-connect";
import { FacebookMediaConnect } from "./facebook-media-connect";
import { TikTokConnect } from "./tiktok-connect";
import { ProfileQR } from "./profile-qr";
import { BankIdStatus } from "./bankid-status";
import { BETA_MODE } from "@/lib/beta";
import { getTranslations } from "next-intl/server";

export default async function ProfilePage() {
  const t = await getTranslations("dashProfile.page");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: socialConn }, { data: media }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, bio, website, category, location, hourly_rate, is_public, categories, locations, rates, websites, social_instagram, social_x, social_facebook, contact_email, contact_phone, role, tier, whitelabel_enabled, whitelabel_brand_name, whitelabel_logo_url, whitelabel_primary_color, whitelabel_accent_color, whitelabel_accent_color_2, whitelabel_accent_color_3, creator_subcategory, dance_styles, dance_languages, dance_experience_years, offers_coaching, coaching_hourly_rate_sek, coaching_specialties, coaching_bio, bankid_verified_at, bankid_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("social_connections")
      .select("instagram_user_id, instagram_username, instagram_access_token, facebook_page_id, facebook_page_name, facebook_page_access_token, tiktok_user_id, tiktok_username, tiktok_access_token")
      .eq("user_id", user.id)
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
          {t("back")}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-[var(--usha-muted)]">
              {isCreator
                ? t("subtitleCreator")
                : t("subtitleCustomer")}
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
              {t("viewProfile")}
            </a>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <ProfileForm profile={profile} isPaidTier={BETA_MODE || profile.tier === 'guld' || profile.tier === 'premium'} isPremium={BETA_MODE || profile.tier === 'premium'} isCustomer={!isCreator} />
      </div>

      <div className="mt-8">
        <BankIdStatus
          verifiedAt={(profile as { bankid_verified_at?: string | null }).bankid_verified_at ?? null}
          bankidName={(profile as { bankid_name?: string | null }).bankid_name ?? null}
          isCreatorRole={isCreator}
          profileRole={(profile as { role?: string | null }).role ?? null}
        />
      </div>

      {isCreator && (
        <>
          <div className="mt-8">
            <ProfileQR
              profileSlug={(profile as { slug?: string | null }).slug ?? null}
              profileId={profile.id}
              fullName={profile.full_name}
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <InstagramConnect
              isConnected={!!socialConn?.instagram_access_token}
              instagramUsername={socialConn?.instagram_username}
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <FacebookMediaConnect
              isConnected={!!socialConn?.facebook_page_access_token}
              pageName={socialConn?.facebook_page_name}
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
            <TikTokConnect
              isConnected={!!socialConn?.tiktok_access_token}
              tiktokUsername={socialConn?.tiktok_username}
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
