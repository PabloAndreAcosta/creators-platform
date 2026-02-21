export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/categories";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Globe, ArrowLeft } from "lucide-react";
import BookingForm from "./booking-form";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, bio, category")
    .eq("id", params.id)
    .eq("is_public", true)
    .single();

  if (!profile) return { title: "Creator – Usha Platform" };

  const categoryLabel = profile.category
    ? CATEGORY_LABELS[profile.category]
    : null;

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

  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, bio, category, location, hourly_rate, website"
      )
      .eq("id", params.id)
      .eq("is_public", true)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, description, category, price, duration_minutes")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const categoryLabel = profile.category
    ? CATEGORY_LABELS[profile.category]
    : null;

  const isLoggedIn = !!user;
  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha</span>
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
                href="/dashboard"
                className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Dashboard
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
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
              {categoryLabel && (
                <span className="rounded-full border border-[var(--usha-border)] px-3 py-0.5">
                  {categoryLabel}
                </span>
              )}
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {profile.location}
                </span>
              )}
              {profile.hourly_rate != null && (
                <span className="font-semibold text-[var(--usha-gold)]">
                  {profile.hourly_rate} SEK/h
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-white"
                >
                  <Globe size={13} />
                  Webbplats
                </a>
              )}
            </div>
            {profile.bio && (
              <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--usha-muted)]">
                {profile.bio}
              </p>
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
                <div
                  key={listing.id}
                  className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
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
                  <div className="flex items-center justify-between">
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
                    </div>
                    {!isOwnProfile && (
                      <BookingForm
                        listing={listing}
                        creatorId={profile.id}
                        isLoggedIn={isLoggedIn}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
