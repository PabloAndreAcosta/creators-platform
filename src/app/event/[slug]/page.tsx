import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { EVENT_CATEGORY_LABELS } from "@/app/app/events/constants";
import { BookButton } from "./book-button";
import { SocialShareButton } from "@/components/social-share-button";

export const revalidate = 60;

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=630&fit=crop";

interface Params {
  params: Promise<{ slug: string }>;
}

async function getListing(slug: string) {
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, user_id, title, description, category, price, duration_minutes, image_url, event_date, event_time, event_end_time, event_location, slug, is_active"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!listing) return null;

  const { data: host } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, bankid_verified_at")
    .eq("id", listing.user_id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const { data: more } = await supabase
    .from("listings")
    .select("id, title, slug, image_url, event_date, event_location, price")
    .eq("is_active", true)
    .neq("id", listing.id)
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(3);

  return { listing, host, more: more ?? [] };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getListing(slug);
  if (!data) return { title: "Event hittades inte" };

  const { listing, host } = data;
  const image = listing.image_url ?? FALLBACK_IMAGE;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";
  const description =
    listing.description?.slice(0, 200) ??
    `En Usha-produktion${host?.full_name ? ` av ${host.full_name}` : ""}.`;

  return {
    title: `${listing.title} — Usha-produktion`,
    description,
    openGraph: {
      title: listing.title,
      description,
      url: `${appUrl}/event/${slug}`,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: listing.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description,
      images: [image],
    },
  };
}

function formatDate(dateStr: string | null, timeStr: string | null) {
  if (!dateStr) return null;
  const time = timeStr ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr.slice(0, 8)) : "12:00:00";
  const date = new Date(`${dateStr}T${time}+02:00`);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  });
}

function formatTime(timeStr: string | null, endTimeStr: string | null) {
  if (!timeStr) return null;
  const start = timeStr.slice(0, 5);
  if (endTimeStr) return `${start} – ${endTimeStr.slice(0, 5)}`;
  return start;
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const data = await getListing(slug);
  if (!data) notFound();

  const { listing, host, more } = data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const image = listing.image_url ?? FALLBACK_IMAGE;
  const categoryLabel = EVENT_CATEGORY_LABELS[listing.category] ?? listing.category;
  const dateLabel = formatDate(listing.event_date, listing.event_time);
  const timeLabel = formatTime(listing.event_time, listing.event_end_time);
  const isFree = !listing.price || listing.price <= 0;
  const returnPath = `/event/${slug}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-white">
      <div className="relative h-[55vh] min-h-[400px] w-full overflow-hidden sm:h-[65vh]">
        <Image
          src={image}
          alt={listing.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-[var(--usha-black)]" />

        <div className="absolute left-6 top-6 z-10">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition hover:bg-black/60"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)] text-[10px] font-bold text-black">
              U
            </span>
            Usha-produktion
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 sm:px-10 sm:pb-16">
          <div className="mx-auto max-w-4xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--usha-gold)]/15 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
              {categoryLabel}
            </span>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              {listing.title}
            </h1>
            {(dateLabel || listing.event_location) && (
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80 sm:text-base">
                {dateLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={16} />
                    {dateLabel}
                  </span>
                )}
                {timeLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={16} />
                    {timeLabel}
                  </span>
                )}
                {listing.event_location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={16} />
                    {listing.event_location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-16">
        <div className="grid gap-8 md:grid-cols-[1fr_280px] md:gap-12">
          <div>
            {listing.description ? (
              <div className="whitespace-pre-wrap text-base leading-relaxed text-white/85 sm:text-lg">
                {listing.description}
              </div>
            ) : (
              <p className="text-base text-white/60">
                Information om denna produktion uppdateras inom kort.
              </p>
            )}

            {listing.duration_minutes && (
              <p className="mt-6 text-sm text-white/60">
                Längd: {listing.duration_minutes} min
              </p>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
              <div className="mb-4 text-center">
                <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">
                  Biljett
                </p>
                <p className="mt-1 text-3xl font-bold text-[var(--usha-gold)]">
                  {isFree ? "Gratis" : `${listing.price} kr`}
                </p>
              </div>
              <BookButton
                listingId={listing.id}
                price={listing.price ?? 0}
                isLoggedIn={!!user}
                returnPath={returnPath}
              />
              {!user && (
                <p className="mt-3 text-center text-[11px] text-[var(--usha-muted)]">
                  Du skapar ett gratis Usch-Ja!-konto i samma flöde
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--usha-muted)]">
                Dela
              </p>
              <SocialShareButton
                title={listing.title}
                description={listing.description ?? undefined}
                url={`${appUrl}/event/${slug}`}
                eventDate={listing.event_date}
                eventLocation={listing.event_location}
                price={listing.price}
              />
            </div>
          </aside>
        </div>

        {host && (
          <div className="mt-12 flex items-center gap-4 border-t border-[var(--usha-border)] pt-8">
            {host.avatar_url && (
              <Image
                src={host.avatar_url}
                alt={host.full_name ?? ""}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">
                Producent
              </p>
              {host.slug ? (
                <Link
                  href={`/creators/${host.slug}`}
                  className="text-sm font-medium text-white/90 hover:text-[var(--usha-gold)]"
                >
                  {host.full_name}
                </Link>
              ) : (
                <span className="text-sm font-medium text-white/90">
                  {host.full_name}
                </span>
              )}
              {host.bankid_verified_at && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-green-400">
                  · BankID-verifierad
                </span>
              )}
            </div>
          </div>
        )}

      </div>

      {more.length > 0 && (
        <section className="border-t border-[var(--usha-border)] bg-[var(--usha-card)]/30">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">
                  Upptäck mer
                </p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Fler Usha-produktioner
                </h2>
              </div>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--usha-border)] px-4 py-2 text-xs font-medium text-white transition hover:border-[var(--usha-gold)]/60 hover:text-[var(--usha-gold)]"
              >
                Se alla →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((m) => (
                <Link
                  key={m.id}
                  href={m.slug ? `/event/${m.slug}` : `/listing/${m.id}`}
                  className="group overflow-hidden rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/40"
                >
                  <div className="relative aspect-[1.91/1] bg-black">
                    {m.image_url ? (
                      <Image
                        src={m.image_url}
                        alt={m.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--usha-muted)]">
                        Usha-produktion
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-1 text-sm font-semibold">{m.title}</h3>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--usha-muted)]">
                      <span className="line-clamp-1">
                        {m.event_date
                          ? new Date(`${m.event_date}T12:00:00+02:00`).toLocaleDateString("sv-SE", {
                              day: "numeric",
                              month: "short",
                              timeZone: "Europe/Stockholm",
                            })
                          : "Datum kommer"}
                        {m.event_location ? ` · ${m.event_location}` : ""}
                      </span>
                      <span className="font-semibold text-[var(--usha-gold)]">
                        {m.price ? `${m.price} kr` : "Gratis"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
