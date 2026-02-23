"use client";

import { useRole } from "@/components/mobile/role-context";
import {
  Calendar,
  Star,
  Heart,
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

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
}

export function HomeContent({
  profile,
  listings,
  topCreators,
  bookingsCount,
}: HomeContentProps) {
  const { role } = useRole();

  if (role === "anvandare") {
    return (
      <AnvandareHome
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
      />
    );
  }

  return (
    <UpplevelseHome profile={profile} bookingsCount={bookingsCount} listings={listings} />
  );
}

/* ─── Användare (Customer) Home ─── */
function AnvandareHome({
  profile,
  listings,
  topCreators,
}: {
  profile: Profile | null;
  listings: Listing[];
  topCreators: TopCreator[];
}) {
  const eventImages = [
    "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop",
  ];

  const events = listings.map((listing) => ({
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

  return (
    <div className="px-4 py-6 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Hej, {profile?.full_name || "där"}! 👋
        </h1>
        <p className="text-sm text-[var(--usha-muted)]">
          Upptäck kreativa upplevelser nära dig
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Sök evenemang, kreatörer, platser..."
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm text-white placeholder:text-[var(--usha-muted)] focus:border-[var(--usha-gold)]/50 focus:outline-none"
        />
      </div>

      {/* Popular Events */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Populära Evenemang</h2>
          <Link href="/marketplace" className="text-xs text-[var(--usha-gold)]">
            Visa alla
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible">
          {events.length > 0 ? events.map((event, i) => (
            <div
              key={i}
              className="min-w-[220px] md:min-w-0 overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)]"
            >
              <div className="relative h-32">
                <img
                  src={eventImages[i % eventImages.length]}
                  alt={event.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
                  <Heart size={14} className="text-white" />
                </button>
                <span className="absolute bottom-2 left-2 rounded-full bg-[var(--usha-gold)]/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                  {event.price}
                </span>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold">{event.title}</h3>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--usha-muted)]">
                  <Calendar size={10} />
                  <span>{event.date}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-12">
              <Calendar size={32} className="mb-3 text-[var(--usha-muted)]" />
              <p className="text-sm text-[var(--usha-muted)]">Inga evenemang ännu</p>
            </div>
          )}
        </div>
      </section>

      {/* Top Creators */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Topp Kreatörer</h2>
          <Link href="/marketplace" className="text-xs text-[var(--usha-gold)]">
            Visa alla
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-5 md:overflow-x-visible">
          {topCreators.length > 0 ? topCreators.map((creator) => (
            <Link
              key={creator.id}
              href={`/creators/${creator.id}`}
              className="flex min-w-[80px] md:min-w-0 flex-col items-center gap-2"
            >
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-[var(--usha-gold)] p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                    <span className="text-lg font-bold text-[var(--usha-gold)]">
                      {(creator.full_name || "?")[0]}
                    </span>
                  </div>
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
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
              <Users size={28} className="mb-2 text-[var(--usha-muted)]" />
              <p className="text-sm text-[var(--usha-muted)]">Inga kreatorer annu</p>
            </div>
          )}
        </div>
      </section>

      {/* Clubs & Studios (Upplevelser) */}
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
                className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:border-[var(--usha-gold)]/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10">
                  <IconComponent size={20} className="text-[var(--usha-gold)]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{venue.name}</h3>
                  <p className="text-xs text-[var(--usha-muted)]">{venue.type}</p>
                </div>
                <ChevronRight size={16} className="text-[var(--usha-muted)]" />
              </div>
            );
          }) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
              <MapPin size={28} className="mb-2 text-[var(--usha-muted)]" />
              <p className="text-sm text-[var(--usha-muted)]">Inga platser att visa annu</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Kreatör (Creator) Home ─── */
function KreatorHome({
  profile,
  bookingsCount,
  listings,
}: {
  profile: Profile | null;
  bookingsCount: number;
  listings: Listing[];
}) {
  const stats = [
    {
      label: "Bokningar",
      value: String(bookingsCount),
      icon: Calendar,
    },
    {
      label: "Intäkter",
      value: `${(profile?.hourly_rate || 0) * bookingsCount} kr`,
      icon: DollarSign,
    },
    {
      label: "Betyg",
      value: "-",
      icon: Star,
      sub: "/5.0",
    },
  ];

  const todaysListings = listings.slice(0, 3).map((listing) => ({
    title: listing.title,
    time: listing.duration_minutes ? `${listing.duration_minutes} min` : "-",
    category: listing.category || "Ovrigt",
  }));

  return (
    <div className="px-4 py-6 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Hej, {profile?.full_name || "Kreatör"}! 👋
        </h1>
        <p className="text-sm text-[var(--usha-muted)]">
          Kreatör · {profile?.category || "Dansinstruktör"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4"
          >
            <stat.icon size={18} className="mb-2 text-[var(--usha-gold)]" />
            <p className="text-xl font-bold">
              {stat.value}
              {stat.sub && (
                <span className="text-xs font-normal text-[var(--usha-muted)]">
                  {stat.sub}
                </span>
              )}
            </p>
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
              <div className="text-right">
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                  {cls.category}
                </span>
              </div>
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
                {bookingsCount > 0
                  ? "Se din kalender for detaljer"
                  : "Inga bokningar just nu"}
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
    </div>
  );
}

/* ─── Upplevelse (Venue/Experience) Home ─── */
function UpplevelseHome({
  profile,
  bookingsCount,
  listings,
}: {
  profile: Profile | null;
  bookingsCount: number;
  listings: Listing[];
}) {
  const stats = [
    { label: "Bokningar", value: String(bookingsCount), icon: Calendar },
    { label: "Besökare", value: String(bookingsCount), icon: Users },
    { label: "Intäkter", value: "-", icon: DollarSign },
  ];

  const upcomingEvents = listings.slice(0, 3).map((listing) => ({
    title: listing.title,
    date: listing.created_at
      ? new Date(listing.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "",
    status: listing.is_active ? "Aktiv" : "Utkast",
  }));

  return (
    <div className="px-4 py-6 space-y-8">
      {/* Greeting */}
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
        {stats.map((stat) => (
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
          <Link href="/app/events" className="text-xs text-[var(--usha-gold)]">
            Hantera
          </Link>
        </div>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
          {upcomingEvents.length > 0 ? upcomingEvents.map((event, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                <Ticket size={18} className="text-[var(--usha-gold)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{event.title}</h3>
                <p className="text-xs text-[var(--usha-muted)]">{event.date}</p>
              </div>
              <div className="text-right">
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    event.status === "Utkast"
                      ? "bg-[var(--usha-muted)]/20 text-[var(--usha-muted)]"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
              <Ticket size={28} className="mb-2 text-[var(--usha-muted)]" />
              <p className="text-sm text-[var(--usha-muted)]">Inga evenemang ännu</p>
            </div>
          )}
        </div>
      </section>

      {/* Active Creators */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Aktiva Kreatörer</h2>
          <span className="text-xs text-[var(--usha-gold)]">Bjud in</span>
        </div>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-8">
            <Users size={28} className="mb-2 text-[var(--usha-muted)]" />
            <p className="text-sm text-[var(--usha-muted)]">Inga aktiva kreatorer ännu</p>
          </div>
        </div>
      </section>
    </div>
  );
}
