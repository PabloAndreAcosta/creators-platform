import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { collabRoleLabel } from "@/lib/collaborators";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, MapPin, Ticket, Users, Pencil } from "lucide-react";
import { EVENT_CATEGORY_LABELS } from "@/app/app/events/constants";
import { BookButton } from "./book-button";
import { WaitlistForm } from "./waitlist-form";
import { getSaleState } from "@/lib/listings/sale-state";
import { getTranslations, getLocale } from "next-intl/server";
import { SocialShareButton } from "@/components/social-share-button";
import { TrackEvent } from "@/components/track-event";

export const revalidate = 60;

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=630&fit=crop";

interface Params {
  params: Promise<{ slug: string }>;
}

async function resolveSlugToOccurrence(slug: string): Promise<string | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from("listings")
    .select("slug, event_date")
    .eq("series_slug", slug)
    .eq("is_active", true)
    .eq("is_public", true)
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (upcoming?.slug) return upcoming.slug;

  const { data: latest } = await supabase
    .from("listings")
    .select("slug")
    .eq("series_slug", slug)
    .eq("is_active", true)
    .eq("is_public", true)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return latest?.slug ?? null;
}

async function getListing(slug: string) {
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, user_id, title, description, category, price, duration_minutes, image_url, event_date, event_time, event_end_time, event_location, slug, is_active, early_bird_start, early_bird_end, early_bird_price, public_sale_at, capacity, tickets_sold"
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
    .eq("is_public", true)
    .neq("id", listing.id)
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(3);

  return { listing, host, more: more ?? [] };
}

async function getCrew(listingId: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // RLS on listing_collaborators is host-or-self only, so the public page reads
  // accepted crew server-side via the service role (key never reaches the client).
  const { data: collabs } = await admin
    .from("listing_collaborators")
    .select("user_id, role, accepted_at")
    .eq("listing_id", listingId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: true });

  if (!collabs || collabs.length === 0) return [];

  const ids = collabs.map((c) => c.user_id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, slug, avatar_url")
    .in("id", ids);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return collabs.map((c) => ({
    user_id: c.user_id,
    role: c.role as string,
    profile: byId.get(c.user_id) ?? null,
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  let data = await getListing(slug);
  if (!data) {
    const resolved = await resolveSlugToOccurrence(slug);
    if (resolved) data = await getListing(resolved);
  }
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

export default async function EventPage(props: Params) {
  const params = await props.params;
  const { slug } = await params;
  let data = await getListing(slug);
  if (!data) {
    const resolved = await resolveSlugToOccurrence(slug);
    if (resolved) redirect(`/event/${resolved}`);
    notFound();
  }

  const { listing, host, more } = data;
  const crew = await getCrew(listing.id);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const image = listing.image_url ?? FALLBACK_IMAGE;
  const categoryLabel = EVENT_CATEGORY_LABELS[listing.category] ?? listing.category;
  const dateLabel = formatDate(listing.event_date, listing.event_time);
  const timeLabel = formatTime(listing.event_time, listing.event_end_time);
  // Timed automation: effective price + whether tickets are buyable right now.
  const t = await getTranslations("eventPage");
  const locale = await getLocale();
  const sale = getSaleState(listing, new Date());
  const isFree = !sale.price || sale.price <= 0;
  const saleUntil = sale.until
    ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", {
        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Stockholm",
      }).format(sale.until)
    : null;
  const saleBadge =
    sale.state === "early_bird" ? t("badgeEarlyBird") :
    sale.state === "sold_out" ? t("badgeSoldOut") :
    sale.state === "before" ? t("badgeComingSoon") : null;
  const saleNote =
    sale.state === "early_bird" && saleUntil ? t("earlyBirdUntil", { date: saleUntil }) :
    sale.state === "before" && saleUntil ? t("releasesAt", { date: saleUntil }) :
    sale.state === "sold_out" && saleUntil ? t("releasesAt", { date: saleUntil }) : null;
  const isHost = !!user && user.id === listing.user_id;
  const returnPath = `/event/${slug}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <TrackEvent
        name="listing_view"
        params={{
          listing_id: listing.id,
          slug,
          price: listing.price ?? 0,
          is_free: isFree,
          category: listing.category,
        }}
      />
      <div className="relative h-[55vh] min-h-[400px] w-full overflow-hidden sm:h-[65vh]">
        <Image
          src={image}
          alt={listing.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black" />

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

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 text-white sm:px-10 sm:pb-16">
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
        {isHost && (
          <div className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-3">
            <span className="mr-1 px-1 text-xs font-medium text-[var(--usha-gold)]">
              Din produktion
            </span>
            <Link
              href={`/app/events/${listing.id}/crew`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--usha-gold)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              <Users size={15} />
              Hantera crew
            </Link>
            <Link
              href={`/app/events/${listing.id}/waitlist`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--usha-border)] px-4 py-2 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60"
            >
              <Clock size={15} />
              Väntelista
            </Link>
            <Link
              href={`/app/events/${listing.id}/edit`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--usha-border)] px-4 py-2 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60"
            >
              <Pencil size={15} />
              Redigera
            </Link>
          </div>
        )}
        <div className="grid gap-8 md:grid-cols-[1fr_280px] md:gap-12">
          <div>
            {listing.description ? (
              <div className="whitespace-pre-wrap text-base leading-relaxed text-[var(--usha-white)] sm:text-lg">
                {listing.description}
              </div>
            ) : (
              <p className="text-base text-[var(--usha-muted)]">
                Information om denna produktion uppdateras inom kort.
              </p>
            )}

            {listing.duration_minutes && (
              <p className="mt-6 text-sm text-[var(--usha-muted)]">
                Längd: {listing.duration_minutes} min
              </p>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
              <div className="mb-4 text-center">
                <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">
                  {saleBadge ?? t("ticket")}
                </p>
                <p className="mt-1 text-3xl font-bold text-[var(--usha-gold)]">
                  {isFree ? t("free") : `${sale.price} kr`}
                </p>
                {saleNote && (
                  <p className="mt-1 text-xs text-[var(--usha-muted)]">{saleNote}</p>
                )}
              </div>
              {sale.buyable ? (
                <BookButton
                  listingId={listing.id}
                  price={sale.price}
                  isLoggedIn={!!user}
                  returnPath={returnPath}
                />
              ) : (
                <div className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--usha-muted)]">
                  {sale.state === "sold_out" ? t("soldOut") : t("notReleased")}
                </div>
              )}
              {sale.buyable && !user && (
                <p className="mt-3 text-center text-[11px] text-[var(--usha-muted)]">
                  {t("createAccountNote")}
                </p>
              )}
            </div>

            <WaitlistForm listingId={listing.id} />

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
                  className="text-sm font-medium text-[var(--usha-white)] hover:text-[var(--usha-gold)]"
                >
                  {host.full_name}
                </Link>
              ) : (
                <span className="text-sm font-medium text-[var(--usha-white)]">
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

        {crew.length > 0 && (
          <div className="mt-8 border-t border-[var(--usha-border)] pt-8">
            <p className="mb-4 text-xs uppercase tracking-wide text-[var(--usha-muted)]">
              Medverkande
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              {crew.map((c) => {
                const p = c.profile;
                const name = p?.full_name ?? "Medverkande";
                const inner = (
                  <>
                    {p?.avatar_url ? (
                      <Image
                        src={p.avatar_url}
                        alt={name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--usha-card)] text-sm font-semibold text-[var(--usha-white)]">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span>
                      <span className="block text-sm font-medium text-[var(--usha-white)]">{name}</span>
                      <span className="block text-[11px] text-[var(--usha-muted)]">
                        {collabRoleLabel(c.role)}
                      </span>
                    </span>
                  </>
                );
                return p?.slug ? (
                  <Link
                    key={c.user_id}
                    href={`/creators/${p.slug}`}
                    className="flex items-center gap-3 transition hover:opacity-80"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={c.user_id} className="flex items-center gap-3">
                    {inner}
                  </div>
                );
              })}
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
                className="inline-flex items-center gap-1 rounded-full border border-[var(--usha-border)] px-4 py-2 text-xs font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60 hover:text-[var(--usha-gold)]"
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
