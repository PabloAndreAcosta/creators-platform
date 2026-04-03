export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/categories";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ExperienceDetails } from "@/types/database";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Globe, ArrowLeft, Calendar, MessageCircle, Users, Instagram, Mail, Phone } from "lucide-react";
import BookingForm from "./booking-form";
import { BuyTicketButton } from "@/components/buy-ticket-button";
import { CreatorReviews } from "@/components/creator-reviews";
import { ReportUserButton } from "@/components/report-user-button";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { CreatorGallery } from "@/components/creator-gallery";
import { CreatorProducts } from "@/components/creator-products";
import { calculateDiscountedPrice } from "@/lib/stripe/commission";
import { filterByGoldExclusivity } from "@/lib/listings/early-bird";

interface Props {
  params: { id: string };
}

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const column = isUUID(params.id) ? "id" : "slug";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, bio, category, categories")
    .eq(column, params.id)
    .eq("is_public", true)
    .single();

  if (!profile) return { title: "Creator – Usha Platform" };

  const cats = profile.categories?.length ? profile.categories : (profile.category ? [profile.category] : []);
  const categoryLabel = cats.map((c: string) => CATEGORY_LABELS[c] || c).join(", ") || null;

  return {
    title: `${profile.full_name || "Creator"} – Usha Platform`,
    description:
      profile.bio?.slice(0, 160) ||
      `${categoryLabel || "Creator"} på Usha Platform`,
    openGraph: {
      title: `${profile.full_name || "Creator"} – Usha`,
      description:
        profile.bio?.slice(0, 160) ||
        `${categoryLabel || "Creator"} på Usha Platform`,
    },
  };
}

export default async function CreatorProfilePage({ params }: Props) {
  const supabase = await createClient();

  const column = isUUID(params.id) ? "id" : "slug";
  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, bio, category, location, hourly_rate, website, stripe_account_id, categories, locations, rates, websites, social_instagram, social_x, social_facebook, contact_email, contact_phone, whitelabel_enabled, whitelabel_brand_name, whitelabel_logo_url, whitelabel_primary_color, whitelabel_accent_color, whitelabel_accent_color_2, whitelabel_accent_color_3"
      )
      .eq(column, params.id)
      .eq("is_public", true)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();

  const { data: allListings } = await supabase
    .from("listings")
    .select("id, title, description, category, price, duration_minutes, event_date, event_time, event_location, release_to_gold_at, listing_type, min_guests, max_guests, experience_details")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Get visitor's tier for discount calculation + early bird filtering
  let visitorTier: string | null = null;
  if (user) {
    const { data: visitorProfile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();
    visitorTier = visitorProfile?.tier ?? null;
  }

  // Filter out Gold-exclusive listings for gratis users
  const listings = filterByGoldExclusivity(allListings || [], visitorTier);

  // Fetch creator availability for current month
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
  const [{ data: availabilityData }, { data: mediaData }, { data: digitalProducts }] = await Promise.all([
    supabase
      .from("creator_availability")
      .select("available_date")
      .eq("user_id", profile.id)
      .gte("available_date", startOfMonth)
      .lte("available_date", endOfMonth),
    supabase
      .from("creator_media")
      .select("id, media_type, url, thumbnail_url, caption, is_hero, section")
      .eq("user_id", profile.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("digital_products")
      .select("id, title, description, price, product_type, video_url, thumbnail_url")
      .eq("creator_id", profile.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);
  const availableDates = (availabilityData || []).map((r) => r.available_date);

  const creatorCategories: string[] = (profile as any).categories?.length ? (profile as any).categories : (profile.category ? [profile.category] : []);
  const creatorLocations: string[] = (profile as any).locations?.length ? (profile as any).locations : (profile.location ? [profile.location] : []);
  const creatorRates: Record<string, number> = (profile as any).rates && typeof (profile as any).rates === "object" ? (profile as any).rates : (profile.category && profile.hourly_rate ? { [profile.category]: profile.hourly_rate } : {});
  const creatorWebsites: string[] = (profile as any).websites?.length ? (profile as any).websites : (profile.website ? [profile.website] : []);

  const isLoggedIn = !!user;
  const isOwnProfile = user?.id === profile.id;
  const hasConnect = !!profile.stripe_account_id;
  const wl = (profile as any).whitelabel_enabled;
  const wlBrand = (profile as any).whitelabel_brand_name;
  const wlLogo = (profile as any).whitelabel_logo_url;
  const wlPrimary = (profile as any).whitelabel_primary_color;
  const wlColor = (profile as any).whitelabel_accent_color;
  const wlColor2 = (profile as any).whitelabel_accent_color_2;
  const wlColor3 = (profile as any).whitelabel_accent_color_3;

  const wlStyle = wl ? {
    ...(wlPrimary ? { '--usha-gold': wlPrimary, '--usha-primary': wlPrimary } : {}),
    ...(wlColor ? { '--usha-accent': wlColor } : {}),
    ...(wlColor2 ? { '--usha-accent-2': wlColor2 } : {}),
    ...(wlColor3 ? { '--usha-accent-3': wlColor3 } : {}),
  } as React.CSSProperties : undefined;

  return (
    <div className="min-h-screen" style={wlStyle}>
      {/* Header */}
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            {wl && wlLogo ? (
              <Image src={wlLogo} alt={wlBrand || "Logo"} width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <span className="text-sm font-bold text-black">U</span>
              </div>
            )}
            <span className="text-lg font-bold tracking-tight">{wl && wlBrand ? wlBrand : "Usha"}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/marketplace"
              className="text-sm text-[var(--usha-muted)] transition hover:text-white"
            >
              Marketplace
            </Link>
            {isLoggedIn ? (
              <Link
                href="/app"
                className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Appen
              </Link>
            ) : (
              <Link
                href="/signup"
                className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Kom igång
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/marketplace"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka till marketplace
        </Link>

        {/* Profile header */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)]">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name || "Creator"}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-[var(--usha-muted)]">
                {profile.full_name?.[0]?.toUpperCase() || "?"}
              </span>
            )}
          </div>

          <div className="flex-1">
            <h1 className="mb-1 text-3xl font-bold">
              {profile.full_name || "Creator"}
            </h1>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--usha-muted)]">
              {creatorCategories.map((cat) => (
                <span key={cat} className="rounded-full border border-[var(--usha-border)] px-3 py-0.5">
                  {CATEGORY_LABELS[cat] || cat}
                </span>
              ))}
              {creatorLocations.map((loc) => (
                <span key={loc} className="flex items-center gap-1">
                  <MapPin size={13} />
                  {loc}
                </span>
              ))}
            </div>
            {Object.keys(creatorRates).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(creatorRates).map(([cat, rate]) => (
                  <span key={cat} className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-0.5 text-xs font-semibold text-[var(--usha-gold)]">
                    {CATEGORY_LABELS[cat] || cat}: {rate} SEK/h
                  </span>
                ))}
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
              {creatorWebsites.map((url) => (
                <a
                  key={url}
                  href={url.startsWith("http") ? url : `https://${url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-white"
                >
                  <Globe size={13} />
                  {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              ))}
              {profile.social_instagram && (
                <a
                  href={`https://instagram.com/${profile.social_instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-white"
                >
                  <Instagram size={13} />
                  {profile.social_instagram}
                </a>
              )}
              {profile.social_x && (
                <a
                  href={`https://x.com/${profile.social_x.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-white"
                >
                  <span className="text-xs font-bold">𝕏</span>
                  {profile.social_x}
                </a>
              )}
              {profile.social_facebook && (
                <a
                  href={profile.social_facebook.startsWith("http") ? profile.social_facebook : `https://facebook.com/${profile.social_facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-white"
                >
                  <span className="text-xs font-bold">f</span>
                  {profile.social_facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "")}
                </a>
              )}
            </div>
            {((profile as any).contact_email || (profile as any).contact_phone) && (
              <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-[var(--usha-muted)]">
                {(profile as any).contact_email && (
                  <a href={`mailto:${(profile as any).contact_email}`} className="flex items-center gap-1 transition-colors hover:text-white">
                    <Mail size={13} />
                    {(profile as any).contact_email}
                  </a>
                )}
                {(profile as any).contact_phone && (
                  <a href={`tel:${(profile as any).contact_phone}`} className="flex items-center gap-1 transition-colors hover:text-white">
                    <Phone size={13} />
                    {(profile as any).contact_phone}
                  </a>
                )}
              </div>
            )}
            {profile.bio && (
              <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--usha-muted)]">
                {profile.bio}
              </p>
            )}
            {isLoggedIn && !isOwnProfile && (
              <div className="mt-4 flex items-center gap-3">
                <Link
                  href={`/app/messages?to=${profile.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
                >
                  <MessageCircle size={14} />
                  Skicka meddelande
                </Link>
                <ReportUserButton userId={profile.id} userName={profile.full_name || "Användare"} />
              </div>
            )}
          </div>
        </div>

        {/* Listings */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Tjänster</h2>
          {!listings || listings.length === 0 ? (
            <p className="text-sm text-[var(--usha-muted)]">
              Inga tjänster publicerade ännu.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="block rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 transition hover:border-[var(--usha-gold)]/30"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold">{listing.title}</h3>
                    {listing.price != null && (
                      <span className="shrink-0 font-semibold text-[var(--usha-gold)]">
                        {listing.price} SEK
                      </span>
                    )}
                  </div>
                  {listing.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-[var(--usha-muted)]">
                      {listing.description}
                    </p>
                  )}
                  {/* Experience details badges */}
                  {listing.experience_details && (() => {
                    const details = listing.experience_details as ExperienceDetails;
                    return details?.included?.length ? (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {details.included.map((item) => (
                          <span key={item} className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] text-[var(--usha-gold)]">
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                        <span className="rounded-full border border-[var(--usha-border)] px-2 py-0.5">
                          {CATEGORY_LABELS[listing.category] || listing.category}
                        </span>
                        {listing.duration_minutes != null && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {listing.duration_minutes} min
                          </span>
                        )}
                        {listing.max_guests && (
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {listing.min_guests ?? 1}–{listing.max_guests} gäster
                          </span>
                        )}
                      </div>
                      {(listing.event_date || listing.event_time || listing.event_location) && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--usha-muted)]">
                          {listing.event_date && (
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                          {listing.event_time && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {listing.event_time.slice(0, 5)}
                            </span>
                          )}
                          {listing.event_location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              {listing.event_location}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isOwnProfile && (
                      <div className="flex items-center gap-2">
                        {listing.price != null && listing.price > 0 && (
                          <BuyTicketButton
                            listingId={listing.id}
                            originalPrice={listing.price}
                            discountedPrice={calculateDiscountedPrice(listing.price, visitorTier)}
                            isLoggedIn={isLoggedIn}
                            hasConnect={hasConnect}
                          />
                        )}
                        <BookingForm
                          listing={listing}
                          creatorId={profile.id}
                          isLoggedIn={isLoggedIn}
                          hasConnect={hasConnect}
                        />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Event Timeline */}
        {(() => {
          const eventsWithDates = (listings || []).filter((l) => l.event_date);
          if (eventsWithDates.length === 0) return null;
          const today = new Date().toISOString().split("T")[0];
          const upcoming = eventsWithDates.filter((l) => l.event_date! >= today).sort((a, b) => a.event_date!.localeCompare(b.event_date!));
          const past = eventsWithDates.filter((l) => l.event_date! < today).sort((a, b) => b.event_date!.localeCompare(a.event_date!));
          return (
            <div className="mt-10">
              <h2 className="mb-4 text-xl font-bold">Evenemang</h2>
              {upcoming.length > 0 && (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-emerald-400">Kommande</h3>
                  <div className="mb-6 space-y-2">
                    {upcoming.map((ev) => (
                      <Link key={ev.id} href={`/listing/${ev.id}`} className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition hover:border-emerald-500/40">
                        <div className="shrink-0 text-center">
                          <div className="text-lg font-bold text-emerald-400">
                            {new Date(ev.event_date + "T00:00").getDate()}
                          </div>
                          <div className="text-[10px] uppercase text-emerald-400/70">
                            {new Date(ev.event_date + "T00:00").toLocaleDateString("sv-SE", { month: "short" })}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{ev.title}</p>
                          <div className="flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                            {ev.event_time && <span>{ev.event_time.slice(0, 5)}</span>}
                            {ev.event_location && <span className="flex items-center gap-1"><MapPin size={10} />{ev.event_location}</span>}
                            {ev.price != null && <span className="text-[var(--usha-gold)]">{ev.price} SEK</span>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
              {past.length > 0 && (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">Tidigare</h3>
                  <div className="space-y-2">
                    {past.slice(0, 10).map((ev) => (
                      <Link key={ev.id} href={`/listing/${ev.id}`} className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 opacity-70 transition hover:opacity-90">
                        <div className="shrink-0 text-center">
                          <div className="text-lg font-bold text-[var(--usha-muted)]">
                            {new Date(ev.event_date + "T00:00").getDate()}
                          </div>
                          <div className="text-[10px] uppercase text-[var(--usha-muted)]">
                            {new Date(ev.event_date + "T00:00").toLocaleDateString("sv-SE", { month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{ev.title}</p>
                          <div className="flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                            {ev.event_location && <span className="flex items-center gap-1"><MapPin size={10} />{ev.event_location}</span>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Portfolio */}
        {mediaData && mediaData.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-xl font-bold">Portfolio</h2>
            <CreatorGallery media={mediaData} />
          </div>
        )}

        {/* Digital products */}
        {digitalProducts && digitalProducts.length > 0 && (
          <div className="mt-10">
            <CreatorProducts products={digitalProducts} isLoggedIn={isLoggedIn} creatorId={profile.id} />
          </div>
        )}

        {/* Availability */}
        <div className="mt-10">
          <AvailabilityCalendar creatorId={profile.id} initialAvailableDates={availableDates} />
        </div>

        {/* Reviews */}
        <div className="mt-10">
          <CreatorReviews creatorId={profile.id} />
        </div>
      </div>
    </div>
  );
}
