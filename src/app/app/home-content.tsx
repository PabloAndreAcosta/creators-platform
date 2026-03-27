"use client";

import { useRole } from "@/components/mobile/role-context";
import {
  Calendar,
  Star,
  MapPin,
  Users,
  DollarSign,
  Clock,
  ChevronRight,
  Music,
  Camera,
  Palette,
  UtensilsCrossed,
  Ticket,
  PartyPopper,
  Waves,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import RecommendedEvents from "@/components/RecommendedEvents";
import { FavoriteButton } from "@/components/favorite-button";
import { SearchBar } from "@/components/search-bar";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  category: string | null;
  location: string | null;
  hourly_rate: number | null;
  is_public: boolean;
  tier: string | null;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type TopCreator = Pick<Profile, "id" | "full_name" | "category" | "avatar_url">;

interface HomeContentProps {
  profile: Profile | null;
  listings: Listing[];
  topCreators: TopCreator[];
  bookingsCount: number;
  monthlyRevenue?: number;
  averageRating?: number | null;
}

export function HomeContent({
  profile,
  listings,
  topCreators,
  bookingsCount,
  monthlyRevenue = 0,
  averageRating = null,
}: HomeContentProps) {
  const { role } = useRole();

  if (role === "publik") {
    return (
      <PublikHome
        profile={profile}
        listings={listings}
        topCreators={topCreators}
      />
    );
  }

  if (role === "kreator") {
    return (
      <KreatorHome
        profile={profile}
        bookingsCount={bookingsCount}
        listings={listings}
        monthlyRevenue={monthlyRevenue}
        averageRating={averageRating}
        tier={profile?.tier || "gratis"}
      />
    );
  }

  return (
    <UpplevelseHome profile={profile} bookingsCount={bookingsCount} listings={listings} monthlyRevenue={monthlyRevenue} averageRating={averageRating} tier={profile?.tier || "gratis"} />
  );
}

/* ─── Publik (Customer) Home ─── */
function PublikHome({
  profile,
  listings,
  topCreators,
}: {
  profile: Profile | null;
  listings: Listing[];
  topCreators: TopCreator[];
}) {
  const eventImages = [
    "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop",
  ];

  const events = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    date: listing.created_at
      ? new Date(listing.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "",
    price: listing.price ? `${listing.price} kr` : "Gratis",
    category: listing.category || "Övrigt",
  }));

  const categoryIconMap: Record<string, LucideIcon> = {
    dance: Music,
    musik: Music,
    music: Music,
    foto: Camera,
    photo: Camera,
    konst: Palette,
    art: Palette,
    restaurant: UtensilsCrossed,
    mat: UtensilsCrossed,
    wellness: Waves,
    spa: Waves,
    yoga: Waves,
    concert: PartyPopper,
    konsert: PartyPopper,
  };

  const venueListings = listings
    .filter((l) => l.category)
    .slice(0, 4)
    .map((l) => ({
      name: l.title,
      type: l.category,
      icon: categoryIconMap[l.category?.toLowerCase()] || Ticket,
    }));

  // Hero event — first listing gets the spotlight
  const heroEvent = events[0] || null;
  const restEvents = events.slice(1);

  return (
    <div className="space-y-8 pb-4">
      {/* Hero Section — full-bleed with glassmorphism */}
      {heroEvent ? (
        <div className="relative -mx-4 -mt-2 overflow-hidden md:-mx-0 md:rounded-2xl">
          <img
            src={eventImages[0]}
            alt={heroEvent.title}
            className="h-[280px] w-full object-cover md:h-[320px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute right-3 top-3">
            <FavoriteButton listingId={heroEvent.id} isLoggedIn={!!profile} />
          </div>
          {/* Trending badge */}
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <TrendingUp size={10} />
            Trending
          </div>
          {/* Glassmorphism info card */}
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
            <div className="flex items-end justify-between">
              <div>
                <span className="mb-1 inline-block rounded-full bg-[var(--usha-gold)] px-2.5 py-0.5 text-[10px] font-bold text-black">
                  {heroEvent.category}
                </span>
                <h2 className="mt-1.5 text-lg font-bold leading-tight text-white drop-shadow">
                  {heroEvent.title}
                </h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                  <Calendar size={11} />
                  <span>{heroEvent.date}</span>
                </div>
              </div>
              <span className="rounded-xl bg-[var(--usha-gold)] px-3 py-1.5 text-sm font-bold text-black shadow-lg">
                {heroEvent.price}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <h1 className="text-2xl font-bold">
            Hej, {profile?.full_name || "där"}!
          </h1>
          <p className="text-sm text-[var(--usha-muted)]">
            Upptäck kreativa upplevelser nära dig
          </p>
        </div>
      )}

      <div className="space-y-8 px-4">
        {/* Greeting — compact when hero exists */}
        {heroEvent && (
          <div>
            <h1 className="text-xl font-bold">
              Hej, {profile?.full_name || "där"}!
            </h1>
            <p className="text-xs text-[var(--usha-muted)]">
              Upptäck kreativa upplevelser nära dig
            </p>
          </div>
        )}

        {/* Search */}
        <SearchBar />

        {/* Event Carousel — snap scroll with dots */}
        {restEvents.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--usha-gold)]" />
                <h2 className="text-lg font-bold">Populära Evenemang</h2>
              </div>
              <Link href="/marketplace" className="text-xs text-[var(--usha-gold)]">
                Visa alla
              </Link>
            </div>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible">
              {restEvents.map((event, i) => (
                <div
                  key={event.id}
                  className="group min-w-[260px] snap-start md:min-w-0 overflow-hidden rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition-all duration-300 hover:border-[var(--usha-gold)]/30 hover:shadow-lg hover:shadow-[var(--usha-gold)]/5"
                >
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={eventImages[(i + 1) % eventImages.length]}
                      alt={event.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute right-2 top-2">
                      <FavoriteButton listingId={event.id} isLoggedIn={!!profile} />
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                        {event.category}
                      </span>
                      <span className="rounded-full bg-[var(--usha-gold)] px-2.5 py-0.5 text-[10px] font-bold text-black">
                        {event.price}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold leading-tight">{event.title}</h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--usha-muted)]">
                      <Calendar size={10} />
                      <span>{event.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No events fallback */}
        {events.length === 0 && (
          <section>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <Calendar size={28} className="text-[var(--usha-gold)]" />
              </div>
              <p className="text-sm font-medium">Inga evenemang ännu</p>
              <p className="mt-1 text-xs text-[var(--usha-muted)]">Kolla tillbaka snart!</p>
            </div>
          </section>
        )}

        {/* Personalized Recommendations */}
        <RecommendedEvents />

        {/* Top Creators — larger avatars with glow */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Topp Kreatörer</h2>
            <Link href="/marketplace" className="text-xs text-[var(--usha-gold)]">
              Visa alla
            </Link>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-5 md:overflow-x-visible">
            {topCreators.length > 0 ? topCreators.map((creator) => (
              <Link
                key={creator.id}
                href={`/creators/${creator.id}`}
                className="group flex min-w-[80px] md:min-w-0 flex-col items-center gap-2"
              >
                <div className="relative">
                  <div className="h-[68px] w-[68px] rounded-full border-2 border-[var(--usha-gold)]/60 p-0.5 transition-all duration-300 group-hover:border-[var(--usha-gold)] group-hover:shadow-lg group-hover:shadow-[var(--usha-gold)]/20">
                    {creator.avatar_url ? (
                      <img
                        src={creator.avatar_url}
                        alt={creator.full_name || ""}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                        <span className="text-lg font-bold text-[var(--usha-gold)]">
                          {(creator.full_name || "?")[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium leading-tight">
                    {(creator.full_name || "Kreator").split(" ")[0]}
                  </p>
                  <p className="text-[10px] text-[var(--usha-muted)]">
                    {creator.category || "Kreator"}
                  </p>
                </div>
              </Link>
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
                <Users size={28} className="mb-2 text-[var(--usha-muted)]" />
                <p className="text-sm text-[var(--usha-muted)]">Inga kreatörer ännu</p>
              </div>
            )}
          </div>
        </section>

        {/* Clubs & Studios — animated hover cards */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Klubbar & Studios</h2>
            <Link href="/marketplace" className="text-xs text-[var(--usha-gold)]">
              Visa alla
            </Link>
          </div>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {venueListings.length > 0 ? venueListings.map((venue, i) => {
              const IconComponent = venue.icon;
              return (
                <div
                  key={i}
                  className="group flex items-center gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-all duration-300 hover:border-[var(--usha-gold)]/30 hover:bg-gradient-to-r hover:from-[var(--usha-gold)]/5 hover:to-transparent"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10 transition-transform duration-300 group-hover:scale-110">
                    <IconComponent size={20} className="text-[var(--usha-gold)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">{venue.name}</h3>
                    <p className="text-xs text-[var(--usha-muted)]">{venue.type}</p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--usha-muted)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--usha-gold)]" />
                </div>
              );
            }) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
                <MapPin size={28} className="mb-2 text-[var(--usha-muted)]" />
                <p className="text-sm text-[var(--usha-muted)]">Inga platser att visa ännu</p>
              </div>
            )}
          </div>
        </section>

        {/* Soft upgrade nudge */}
        {profile?.tier !== "guld" && profile?.tier !== "premium" && (
          <section>
            <Link
              href="/dashboard/billing"
              className="group block overflow-hidden rounded-2xl border border-[var(--usha-gold)]/20 bg-gradient-to-r from-[var(--usha-gold)]/5 via-[var(--usha-accent)]/5 to-transparent p-5 transition-all duration-300 hover:border-[var(--usha-gold)]/40"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                  <Sparkles size={18} className="text-[var(--usha-gold)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Bli Guld-medlem</p>
                  <p className="text-xs text-[var(--usha-muted)]">
                    10% rabatt och tidig tillgång till alla events
                  </p>
                </div>
                <ChevronRight size={16} className="text-[var(--usha-gold)]/60 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

/* ─── Kreatör (Creator) Home ─── */
function KreatorHome({
  profile,
  bookingsCount,
  listings,
  monthlyRevenue = 0,
  averageRating = null,
  tier = "gratis",
}: {
  profile: Profile | null;
  bookingsCount: number;
  listings: Listing[];
  monthlyRevenue?: number;
  averageRating?: number | null;
  tier?: string;
}) {
  const isPremium = tier === "premium";
  const isGuld = tier === "guld";
  const commission = isPremium ? 3 : isGuld ? 8 : 15;

  const todaysListings = listings.slice(0, 3).map((listing) => ({
    title: listing.title,
    time: listing.duration_minutes ? `${listing.duration_minutes} min` : "-",
    category: listing.category || "Övrigt",
  }));

  /* ── Premium: command-center layout ── */
  if (isPremium) {
    return (
      <div className="px-4 py-6 space-y-6">
        {/* Header — minimal */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{profile?.full_name || "Kreatör"}</h1>
            <p className="text-[11px] text-[var(--usha-muted)]">Premium · {commission}% kommission</p>
          </div>
          <Link
            href="/app/calendar"
            className="rounded-lg bg-[var(--usha-card)] border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] transition hover:text-white"
          >
            Kalender
          </Link>
        </div>

        {/* KPI ribbon — single row */}
        <div className="flex gap-2">
          {[
            { label: "Intäkter", value: `${monthlyRevenue.toLocaleString("sv-SE")} kr` },
            { label: "Bokningar", value: String(bookingsCount) },
            { label: "Betyg", value: averageRating != null ? `${averageRating}/5` : "—" },
            { label: "Tjänster", value: String(listings.length) },
          ].map((kpi) => (
            <div key={kpi.label} className="flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-3 text-center">
              <p className="text-base font-bold leading-none">{kpi.value}</p>
              <p className="mt-1 text-[10px] text-[var(--usha-muted)]">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions — 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Ny tjänst", href: "/app/courses", icon: Clock },
            { label: "Bokningar", href: "/app/calendar", icon: Calendar },
            { label: "Meddelanden", href: "/app/messages", icon: Users },
            { label: "Profil", href: "/app/profile", icon: Star },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30"
            >
              <action.icon size={16} className="text-[var(--usha-muted)]" />
              {action.label}
            </Link>
          ))}
        </div>

        {/* Recent activity feed */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">Dina tjänster</h2>
          <div className="space-y-1.5">
            {todaysListings.length > 0 ? todaysListings.map((cls, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span className="text-sm">{cls.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--usha-muted)]">{cls.time}</span>
                  <span className="rounded bg-[var(--usha-card)] px-1.5 py-0.5 text-[9px] text-[var(--usha-muted)] border border-[var(--usha-border)]">{cls.category}</span>
                </div>
              </div>
            )) : (
              <p className="py-4 text-center text-sm text-[var(--usha-muted)]">Inga tjänster ännu</p>
            )}
          </div>
        </section>

        {/* Bookings — compact */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[var(--usha-muted)]" />
            <span className="text-sm">{bookingsCount} aktiva bokningar</span>
          </div>
          <Link href="/app/calendar" className="text-xs text-[var(--usha-gold)]">
            Visa
          </Link>
        </div>
      </div>
    );
  }

  /* ── Guld: functional, compact ── */
  if (isGuld) {
    return (
      <div className="px-4 py-6 space-y-6">
        {/* Header with commission badge */}
        <div>
          <h1 className="text-xl font-bold">
            Hej, {profile?.full_name || "Kreatör"}!
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-[var(--usha-muted)]">Kreatör · {profile?.category || "Kreativ"}</span>
            <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--usha-gold)]">
              {commission}% kommission
            </span>
          </div>
        </div>

        {/* Compact stat bar */}
        <div className="flex items-center gap-4 rounded-xl border border-[var(--usha-gold)]/20 bg-[var(--usha-gold)]/5 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-bold">{monthlyRevenue.toLocaleString("sv-SE")} kr</span>
          </div>
          <div className="h-4 w-px bg-[var(--usha-border)]" />
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-bold">{bookingsCount}</span>
          </div>
          <div className="h-4 w-px bg-[var(--usha-border)]" />
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-bold">{averageRating != null ? `${averageRating}/5` : "—"}</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Ny tjänst", href: "/app/courses", icon: Clock },
            { label: "Bokningar", href: "/app/calendar", icon: Calendar },
            { label: "Meddelanden", href: "/app/messages", icon: Users },
            { label: "Statistik", href: "/dashboard", icon: TrendingUp },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30"
            >
              <action.icon size={16} className="text-[var(--usha-gold)]" />
              {action.label}
            </Link>
          ))}
        </div>

        {/* Listings */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Dina Tjänster</h2>
            <Link href="/app/courses" className="text-xs text-[var(--usha-gold)]">Alla</Link>
          </div>
          <div className="space-y-2">
            {todaysListings.length > 0 ? todaysListings.map((cls, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3">
                <Clock size={16} className="text-[var(--usha-gold)]" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium">{cls.title}</h3>
                  <p className="text-[10px] text-[var(--usha-muted)]">{cls.time} · {cls.category}</p>
                </div>
              </div>
            )) : (
              <p className="py-6 text-center text-sm text-[var(--usha-muted)]">Inga tjänster ännu</p>
            )}
          </div>
        </section>

        {/* Bookings */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3">
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-[var(--usha-gold)]" />
            <span className="text-sm">{bookingsCount} aktiva bokningar</span>
          </div>
          <Link href="/app/calendar" className="rounded-lg bg-[var(--usha-gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)]">
            Kalender
          </Link>
        </div>
      </div>
    );
  }

  /* ── Gratis: visual, encouraging ── */
  return (
    <div className="px-4 py-6 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Hej, {profile?.full_name || "Kreatör"}! 👋
        </h1>
        <p className="text-sm text-[var(--usha-muted)]">
          Kreatör · {profile?.category || "Kreativ"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bokningar", value: String(bookingsCount), icon: Calendar },
          { label: "Intäkter", value: `${monthlyRevenue.toLocaleString("sv-SE")} kr`, icon: DollarSign },
          { label: "Betyg", value: averageRating != null ? `${averageRating}/5` : "—", icon: Star },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4"
          >
            <stat.icon size={18} className="mb-2 text-[var(--usha-gold)]" />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[11px] text-[var(--usha-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Today's Listings */}
      <section>
        <h2 className="mb-4 text-lg font-bold">Dina Tjänster</h2>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
          {todaysListings.length > 0 ? todaysListings.map((cls, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                <Clock size={18} className="text-[var(--usha-gold)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{cls.title}</h3>
                <p className="text-xs text-[var(--usha-muted)]">{cls.time}</p>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                {cls.category}
              </span>
            </div>
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
              <Clock size={28} className="mb-2 text-[var(--usha-muted)]" />
              <p className="text-sm text-[var(--usha-muted)]">Inga tjänster ännu</p>
            </div>
          )}
        </div>
      </section>

      {/* Bookings Summary */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Bokningar</h2>
          <Link href="/app/calendar" className="text-xs text-[var(--usha-gold)]">
            Visa alla
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
              <Calendar size={18} className="text-[var(--usha-gold)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">
                Du har {bookingsCount} aktiva bokningar
              </h3>
              <p className="text-xs text-[var(--usha-muted)]">
                {bookingsCount > 0 ? "Se din kalender för detaljer" : "Inga bokningar just nu"}
              </p>
            </div>
            <Link
              href="/app/calendar"
              className="rounded-lg bg-[var(--usha-gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)]"
            >
              Kalender
            </Link>
          </div>
        </div>
      </section>

      {/* Upgrade nudge */}
      <Link
        href="/dashboard/billing"
        className="group block rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-r from-[var(--usha-gold)]/5 to-transparent p-4 transition hover:border-[var(--usha-gold)]/40"
      >
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-[var(--usha-gold)]" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sänk din kommission till 8%</p>
            <p className="text-[11px] text-[var(--usha-muted)]">Du betalar 15% idag — uppgradera till Guld</p>
          </div>
          <ChevronRight size={14} className="text-[var(--usha-gold)]/60 transition group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}

/* ─── Upplevelse (Venue/Experience) Home ─── */
function UpplevelseHome({
  profile,
  bookingsCount,
  listings,
  monthlyRevenue = 0,
  averageRating = null,
  tier = "gratis",
}: {
  profile: Profile | null;
  bookingsCount: number;
  listings: Listing[];
  monthlyRevenue?: number;
  averageRating?: number | null;
  tier?: string;
}) {
  const isPremium = tier === "premium";
  const isGuld = tier === "guld";
  const commission = isPremium ? 3 : isGuld ? 8 : 15;

  const activeEvents = listings.filter((l) => l.is_active);
  const draftEvents = listings.filter((l) => !l.is_active);

  const upcomingEvents = listings.slice(0, 5).map((listing) => ({
    title: listing.title,
    date: listing.created_at
      ? new Date(listing.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
      : "",
    status: listing.is_active ? "Aktiv" : "Utkast",
  }));

  /* ── Premium: ops-center ── */
  if (isPremium) {
    return (
      <div className="px-4 py-6 space-y-6">
        {/* Header — minimal */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{profile?.full_name || "Upplevelse"}</h1>
            <p className="text-[11px] text-[var(--usha-muted)]">Premium · {commission}% kommission</p>
          </div>
          <Link
            href="/app/scan"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1.5 text-xs font-bold text-black"
          >
            <Camera size={12} />
            Skanna
          </Link>
        </div>

        {/* KPI ribbon */}
        <div className="flex gap-2">
          {[
            { label: "Intäkter", value: `${monthlyRevenue.toLocaleString("sv-SE")} kr` },
            { label: "Bokningar", value: String(bookingsCount) },
            { label: "Events", value: String(activeEvents.length) },
            { label: "Utkast", value: String(draftEvents.length) },
          ].map((kpi) => (
            <div key={kpi.label} className="flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-3 text-center">
              <p className="text-base font-bold leading-none">{kpi.value}</p>
              <p className="mt-1 text-[10px] text-[var(--usha-muted)]">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Nytt event", href: "/app/events", icon: Ticket },
            { label: "Skanna biljett", href: "/app/scan", icon: Camera },
            { label: "Meddelanden", href: "/app/messages", icon: Users },
            { label: "Evenemang", href: "/app/events", icon: Calendar },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30"
            >
              <action.icon size={16} className="text-[var(--usha-muted)]" />
              {action.label}
            </Link>
          ))}
        </div>

        {/* Event pipeline */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">Event-pipeline</h2>
          <div className="space-y-1.5">
            {upcomingEvents.length > 0 ? upcomingEvents.map((event, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${event.status === "Aktiv" ? "bg-green-400" : "bg-[var(--usha-muted)]"}`} />
                  <span className="text-sm">{event.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--usha-muted)]">{event.date}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    event.status === "Aktiv" ? "bg-green-500/10 text-green-400" : "bg-[var(--usha-muted)]/10 text-[var(--usha-muted)]"
                  }`}>{event.status}</span>
                </div>
              </div>
            )) : (
              <p className="py-4 text-center text-sm text-[var(--usha-muted)]">Inga events ännu</p>
            )}
          </div>
        </section>
      </div>
    );
  }

  /* ── Guld: functional dashboard ── */
  if (isGuld) {
    return (
      <div className="px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Hej, {profile?.full_name || "där"}!</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-[var(--usha-muted)]">Upplevelse · {profile?.category || "Venue"}</span>
            <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--usha-gold)]">
              {commission}% kommission
            </span>
          </div>
        </div>

        {/* Compact stat bar */}
        <div className="flex items-center gap-4 rounded-xl border border-[var(--usha-gold)]/20 bg-[var(--usha-gold)]/5 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-bold">{monthlyRevenue.toLocaleString("sv-SE")} kr</span>
          </div>
          <div className="h-4 w-px bg-[var(--usha-border)]" />
          <div className="flex items-center gap-1.5">
            <Ticket size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-bold">{activeEvents.length} events</span>
          </div>
          <div className="h-4 w-px bg-[var(--usha-border)]" />
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-bold">{bookingsCount}</span>
          </div>
        </div>

        {/* Quick actions with scan button */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/app/scan" className="flex items-center gap-2.5 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-3 text-sm font-medium text-[var(--usha-gold)]">
            <Camera size={16} />
            Skanna biljett
          </Link>
          <Link href="/app/events" className="flex items-center gap-2.5 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30">
            <Ticket size={16} className="text-[var(--usha-gold)]" />
            Evenemang
          </Link>
        </div>

        {/* Events list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Kommande Evenemang</h2>
            <Link href="/app/events" className="text-xs text-[var(--usha-gold)]">Hantera</Link>
          </div>
          <div className="space-y-2">
            {upcomingEvents.length > 0 ? upcomingEvents.slice(0, 4).map((event, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3">
                <Ticket size={16} className="text-[var(--usha-gold)]" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium">{event.title}</h3>
                  <p className="text-[10px] text-[var(--usha-muted)]">{event.date}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  event.status === "Aktiv" ? "bg-green-500/20 text-green-400" : "bg-[var(--usha-muted)]/20 text-[var(--usha-muted)]"
                }`}>{event.status}</span>
              </div>
            )) : (
              <p className="py-6 text-center text-sm text-[var(--usha-muted)]">Inga events ännu</p>
            )}
          </div>
        </section>
      </div>
    );
  }

  /* ── Gratis: visual, encouraging ── */
  return (
    <div className="px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Hej, {profile?.full_name || "där"}! 👋
        </h1>
        <p className="text-sm text-[var(--usha-muted)]">
          Upplevelse · {profile?.category || "Venue"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bokningar", value: String(bookingsCount), icon: Calendar },
          { label: "Betyg", value: averageRating != null ? `${averageRating}/5` : "—", icon: Star },
          { label: "Intäkter", value: `${monthlyRevenue.toLocaleString("sv-SE")} kr`, icon: DollarSign },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4"
          >
            <stat.icon size={18} className="mb-2 text-[var(--usha-gold)]" />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[11px] text-[var(--usha-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Events */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Kommande Evenemang</h2>
          <Link href="/app/events" className="text-xs text-[var(--usha-gold)]">Hantera</Link>
        </div>
        <div className="space-y-3">
          {upcomingEvents.length > 0 ? upcomingEvents.slice(0, 3).map((event, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                <Ticket size={18} className="text-[var(--usha-gold)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{event.title}</h3>
                <p className="text-xs text-[var(--usha-muted)]">{event.date}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                event.status === "Aktiv" ? "bg-green-500/20 text-green-400" : "bg-[var(--usha-muted)]/20 text-[var(--usha-muted)]"
              }`}>{event.status}</span>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-12">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <Ticket size={24} className="text-[var(--usha-gold)]" />
              </div>
              <p className="text-sm font-medium">Skapa ditt första event</p>
              <p className="mt-1 text-xs text-[var(--usha-muted)]">Börja sälja biljetter idag</p>
              <Link href="/app/events" className="mt-4 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2 text-xs font-bold text-black">
                Skapa event
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Upgrade nudge */}
      <Link
        href="/dashboard/billing"
        className="group block rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-r from-[var(--usha-gold)]/5 to-transparent p-4 transition hover:border-[var(--usha-gold)]/40"
      >
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-[var(--usha-gold)]" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sänk din kommission till 8%</p>
            <p className="text-[11px] text-[var(--usha-muted)]">Du betalar 15% idag — uppgradera till Guld</p>
          </div>
          <ChevronRight size={14} className="text-[var(--usha-gold)]/60 transition group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}
