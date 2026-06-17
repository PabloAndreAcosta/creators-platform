export const revalidate = 60; // ISR: revalidate every 60 seconds

import { createClient } from "@/lib/supabase/server";
import { safeJsonLd } from "@/lib/json-ld";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Calendar, ArrowLeft, User, ChevronRight } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/categories";

interface Props {
  params: Promise<{ slug: string }>;
}

type Occurrence = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  event_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  event_location: string | null;
  event_lat: number | null;
  event_lng: number | null;
  image_url: string | null;
  user_id: string;
};

async function fetchSeries(slug: string): Promise<Occurrence[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id, slug, title, description, category, price, event_date, event_time, event_end_time, event_location, event_lat, event_lng, image_url, user_id"
    )
    .eq("series_slug", slug)
    .eq("is_active", true)
    .order("event_date", { ascending: true });
  return (data as Occurrence[] | null) ?? [];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const occurrences = await fetchSeries(params.slug);
  if (occurrences.length === 0) return { title: "Serie – Usha Platform" };

  const s = occurrences[0];
  const description = s.description?.slice(0, 160) || `${s.title} – återkommande tillfällen på Usha Platform`;
  const url = `https://usha.se/series/${params.slug}`;

  return {
    title: `${s.title} – Usha Platform`,
    description,
    openGraph: {
      title: `${s.title} – Usha Platform`,
      description,
      url,
      type: "website",
      ...(s.image_url ? { images: [{ url: s.image_url, width: 1200, height: 630, alt: s.title }] } : {}),
    },
  };
}

function formatDate(date: string) {
  return new Date(date + "T00:00").toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function OccurrenceRow({ o, past }: { o: Occurrence; past?: boolean }) {
  const href = `/listing/${o.slug || o.id}`;
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/30 ${past ? "opacity-70" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {o.event_date && (
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar size={14} className="text-[var(--usha-gold)]" />
              {formatDate(o.event_date)}
            </span>
          )}
          {o.event_time && (
            <span className="flex items-center gap-1.5 text-[var(--usha-muted)]">
              <Clock size={14} />
              {o.event_time.slice(0, 5)}
              {o.event_end_time && ` – ${o.event_end_time.slice(0, 5)}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {o.price != null && (
          <span className="text-sm font-semibold text-[var(--usha-gold)]">
            {o.price > 0 ? `${o.price} SEK` : "Gratis"}
          </span>
        )}
        <span className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1.5 text-xs font-semibold text-black">
          {past ? "Visa" : "Boka"}
          <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

export default async function SeriesPage(props: Props) {
  const params = await props.params;
  const occurrences = await fetchSeries(params.slug);
  if (occurrences.length === 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const series = occurrences[0];

  // Creator profile
  const { data: creator } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, category, slug")
    .eq("id", series.user_id)
    .single();

  const creatorUrl = creator?.slug ? `/${creator.slug}` : `/creators/${series.user_id}`;

  // Split upcoming vs past (today inclusive = upcoming). Past kept as a library.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = occurrences.filter((o) => !o.event_date || o.event_date >= today);
  const past = occurrences.filter((o) => o.event_date && o.event_date < today).reverse();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    name: series.title,
    url: `https://usha.se/series/${params.slug}`,
    ...(series.description ? { description: series.description.slice(0, 300) } : {}),
    ...(series.image_url ? { image: series.image_url } : {}),
    ...(creator
      ? { organizer: { "@type": "Person", name: creator.full_name || "Creator", url: `https://usha.se${creatorUrl}` } }
      : {}),
    subEvent: occurrences
      .filter((o) => o.event_date)
      .map((o) => ({
        "@type": "Event",
        name: series.title,
        startDate: o.event_time ? `${o.event_date}T${o.event_time}` : o.event_date,
        url: `https://usha.se/listing/${o.slug || o.id}`,
        ...(o.event_location ? { location: { "@type": "Place", name: o.event_location } } : {}),
      })),
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      {/* Header */}
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 md:px-6">
          <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha Platform</span>
          </Link>
          <Link
            href={isLoggedIn ? "/app" : "/signup"}
            className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            {isLoggedIn ? "Appen" : "Kom igång"}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Link
          href={creatorUrl}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          Tillbaka till {creator?.full_name || "kreatören"}
        </Link>

        {/* Series header */}
        {series.image_url && (
          <div className="mb-6 overflow-hidden rounded-2xl">
            <img
              src={series.image_url}
              alt={series.title}
              className="w-full max-h-[260px] object-cover sm:max-h-[340px] md:max-h-[420px]"
            />
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--usha-border)] px-3 py-0.5 text-xs text-[var(--usha-muted)]">
            {CATEGORY_LABELS[series.category] || series.category}
          </span>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-0.5 text-xs font-semibold text-[var(--usha-gold)]">
            Återkommande serie
          </span>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{series.title}</h1>

        {series.event_location && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--usha-muted)]">
            <MapPin size={14} className="text-[var(--usha-gold)]" />
            {series.event_location}
          </p>
        )}

        {series.description && (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--usha-muted)]">
            {series.description}
          </p>
        )}

        {/* Upcoming */}
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            Kommande tillfällen {upcoming.length > 0 && <span className="text-[var(--usha-muted)]">({upcoming.length})</span>}
          </h2>
          {upcoming.length > 0 ? (
            <div className="space-y-2.5">
              {upcoming.map((o) => (
                <OccurrenceRow key={o.id} o={o} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm text-[var(--usha-muted)]">
              Inga kommande tillfällen just nu. Håll utkik!
            </p>
          )}
        </div>

        {/* Past — library of previous occurrences */}
        {past.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">
              Tidigare tillfällen <span className="text-[var(--usha-muted)]">({past.length})</span>
            </h2>
            <div className="space-y-2.5">
              {past.map((o) => (
                <OccurrenceRow key={o.id} o={o} past />
              ))}
            </div>
          </div>
        )}

        {/* Creator card */}
        {creator && (
          <Link
            href={creatorUrl}
            className="mt-8 flex items-center gap-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/30"
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
        )}
      </div>
    </div>
  );
}
