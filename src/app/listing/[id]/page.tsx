export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ExperienceDetails } from "@/types/database";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Clock,
  Calendar,
  ArrowLeft,
  Users,
  User,
} from "lucide-react";
import BookingForm from "@/app/creators/[id]/booking-form";
import { BuyTicketButton } from "@/components/buy-ticket-button";
import { CATEGORY_LABELS } from "@/lib/categories";
import { calculateDiscountedPrice } from "@/lib/stripe/commission";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("title, description, event_location")
    .eq("id", params.id)
    .eq("is_active", true)
    .single();

  if (!listing) return { title: "Event – Usha" };

  return {
    title: `${listing.title} – Usha`,
    description: listing.description?.slice(0, 160) || `${listing.title} på Usha Platform`,
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const supabase = await createClient();

  const [{ data: listing }, { data: { user } }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, description, category, price, duration_minutes, event_date, event_time, event_end_time, event_location, event_lat, event_lng, image_url, listing_type, min_guests, max_guests, experience_details, user_id, is_active"
      )
      .eq("id", params.id)
      .eq("is_active", true)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!listing) notFound();

  // Fetch creator profile
  const { data: creator } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, category, stripe_account_id, slug")
    .eq("id", listing.user_id)
    .single();

  if (!creator) notFound();

  // Get visitor tier for discounts
  let visitorTier: string | null = null;
  if (user) {
    const { data: vp } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();
    visitorTier = vp?.tier ?? null;
  }

  const isLoggedIn = !!user;
  const isOwner = user?.id === listing.user_id;
  const hasConnect = !!creator.stripe_account_id;
  const details = listing.experience_details as ExperienceDetails | null;
  const creatorUrl = creator.slug ? `/${creator.slug}` : `/creators/${creator.id}`;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 md:px-6">
          <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha</span>
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
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Link
          href={creatorUrl}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka till {creator.full_name || "kreatören"}
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Main content */}
          <div>
            {/* Event image */}
            {listing.image_url && (
              <div className="mb-6 overflow-hidden rounded-2xl">
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="w-full max-h-[260px] object-cover sm:max-h-[340px] md:max-h-[420px]"
                />
              </div>
            )}

            {/* Title & category */}
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full border border-[var(--usha-border)] px-3 py-0.5 text-xs text-[var(--usha-muted)]">
                  {CATEGORY_LABELS[listing.category] || listing.category}
                </span>
                {listing.price != null && (
                  <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-0.5 text-xs font-semibold text-[var(--usha-gold)]">
                    {listing.price > 0 ? `${listing.price} SEK` : "Gratis"}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">{listing.title}</h1>
            </div>

            {/* Date, time, location, duration */}
            {(listing.event_date || listing.event_time || listing.event_location || listing.duration_minutes) && (
              <div className="mb-6 flex flex-wrap gap-3 text-xs text-[var(--usha-muted)] sm:gap-4 sm:text-sm">
                {listing.event_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-[var(--usha-gold)]" />
                    {new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                )}
                {listing.event_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-[var(--usha-gold)]" />
                    {listing.event_time.slice(0, 5)}
                    {listing.event_end_time && ` – ${listing.event_end_time.slice(0, 5)}`}
                  </span>
                )}
                {listing.duration_minutes && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {listing.duration_minutes} min
                  </span>
                )}
                {listing.event_location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[var(--usha-gold)]" />
                    {listing.event_location}
                  </span>
                )}
                {listing.max_guests && (
                  <span className="flex items-center gap-1.5">
                    <Users size={14} />
                    {listing.min_guests ?? 1}–{listing.max_guests} gäster
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div className="mb-6">
                <h2 className="mb-2 text-lg font-semibold">Om evenemanget</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--usha-muted)]">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Experience details */}
            {details?.included?.length ? (
              <div className="mb-6">
                <h2 className="mb-2 text-lg font-semibold">Vad ingår</h2>
                <div className="flex flex-wrap gap-2">
                  {details.included.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {details?.amenities?.length ? (
              <div className="mb-6">
                <h2 className="mb-2 text-lg font-semibold">Bekvämligheter</h2>
                <div className="flex flex-wrap gap-2">
                  {details.amenities.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[var(--usha-border)] px-3 py-1 text-xs text-[var(--usha-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Map */}
            {listing.event_lat && listing.event_lng && (
              <div className="mb-6">
                <h2 className="mb-2 text-lg font-semibold">Karta</h2>
                <div className="overflow-hidden rounded-xl border border-[var(--usha-border)]">
                  <iframe
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    className="sm:h-[300px]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${listing.event_lat},${listing.event_lng}&zoom=15&language=sv`}
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${listing.event_lat},${listing.event_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[var(--usha-card)] px-4 py-3 text-sm text-[var(--usha-muted)] transition hover:text-white"
                  >
                    <MapPin size={14} className="text-[var(--usha-gold)]" />
                    {listing.event_location || "Öppna i Google Maps"}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — booking + creator */}
          <div className="space-y-4">
            {/* Booking card */}
            <div className="space-y-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 sm:p-6 lg:sticky lg:top-6">
              {isOwner && (
                <p className="text-center text-xs text-[var(--usha-muted)]">
                  Förhandsvisning — så ser besökare sidan
                </p>
              )}
              <div className="text-center">
                {listing.price != null && (
                  <p className="text-2xl font-bold text-[var(--usha-gold)]">
                    {listing.price > 0 ? `${listing.price} SEK` : "Gratis"}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
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
                  creatorId={creator.id}
                  isLoggedIn={isLoggedIn}
                  hasConnect={hasConnect}
                />
              </div>
            </div>

            {/* Creator card */}
            <Link
              href={creatorUrl}
              className="flex items-center gap-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/30"
            >
              {creator.avatar_url ? (
                <Image
                  src={creator.avatar_url}
                  alt={creator.full_name || ""}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                  <User size={20} className="text-[var(--usha-gold)]" />
                </div>
              )}
              <div>
                <p className="font-semibold">{creator.full_name || "Kreatör"}</p>
                <p className="text-xs text-[var(--usha-muted)]">
                  {CATEGORY_LABELS[creator.category] || creator.category} · Visa profil
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
