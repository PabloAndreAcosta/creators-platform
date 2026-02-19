"use client";

import { useRole } from "@/components/mobile/role-context";
import {
  Calendar,
  Star,
  Heart,
  MapPin,
  TrendingUp,
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
import Link from "next/link";

interface HomeContentProps {
  profile: any;
  listings: any[];
  topCreators: any[];
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
    <UpplevelseHome profile={profile} bookingsCount={bookingsCount} />
  );
}

/* ─── Användare (Customer) Home ─── */
function AnvandareHome({
  profile,
  listings,
  topCreators,
}: {
  profile: any;
  listings: any[];
  topCreators: any[];
}) {
  const eventImages = [
    "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop",
  ];

  const mockEvents = [
    { title: "Street Dance Workshop", date: "15 feb, 18:00", price: "299 kr", category: "Dans" },
    { title: "Summer Salsa Social", date: "18 feb, 20:00", price: "199 kr", category: "Dans" },
    { title: "Akustisk Kväll", date: "20 feb, 19:00", price: "349 kr", category: "Musik" },
    { title: "Foto Workshop", date: "22 feb, 10:00", price: "599 kr", category: "Foto" },
    { title: "Jazz på Taket", date: "25 feb, 21:00", price: "249 kr", category: "Musik" },
    { title: "Yoga & Meditation", date: "28 feb, 08:00", price: "199 kr", category: "Wellness" },
  ];

  const clubsStudios = [
    { name: "Dansens Hus", type: "Dansstudio", icon: Music },
    { name: "Fotografiska", type: "Galleri & Studio", icon: Camera },
    { name: "Malmö Live", type: "Konserthus", icon: PartyPopper },
    { name: "Ribersborgs Kallbadhus", type: "Spa & Wellness", icon: Waves },
  ];

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
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {mockEvents.map((event, i) => (
            <div
              key={i}
              className="min-w-[220px] overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)]"
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
          ))}
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
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {(topCreators.length > 0
            ? topCreators
            : [
                { id: "1", full_name: "Maria Lindström", category: "Dans", avatar_url: null },
                { id: "2", full_name: "Erik Johansson", category: "Musik", avatar_url: null },
                { id: "3", full_name: "Sofia Andersson", category: "Foto", avatar_url: null },
                { id: "4", full_name: "Oscar Nilsson", category: "Konst", avatar_url: null },
                { id: "5", full_name: "Emma Karlsson", category: "Yoga", avatar_url: null },
              ]
          ).map((creator: any, i: number) => (
            <Link
              key={creator.id}
              href={`/creators/${creator.id}`}
              className="flex min-w-[80px] flex-col items-center gap-2"
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
                  {(creator.full_name || "Kreatör").split(" ")[0]}
                </p>
                <div className="mt-0.5 flex items-center gap-0.5">
                  <Star size={8} className="fill-[var(--usha-gold)] text-[var(--usha-gold)]" />
                  <span className="text-[10px] text-[var(--usha-muted)]">
                    {(4.5 + Math.random() * 0.5).toFixed(1)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
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
        <div className="space-y-3">
          {clubsStudios.map((club, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:border-[var(--usha-gold)]/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10">
                <club.icon size={20} className="text-[var(--usha-gold)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{club.name}</h3>
                <p className="text-xs text-[var(--usha-muted)]">{club.type}</p>
              </div>
              <ChevronRight size={16} className="text-[var(--usha-muted)]" />
            </div>
          ))}
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
  profile: any;
  bookingsCount: number;
  listings: any[];
}) {
  const stats = [
    {
      label: "Bokningar",
      value: String(bookingsCount),
      icon: Calendar,
      trend: "+12%",
    },
    {
      label: "Intäkter",
      value: `${(profile?.hourly_rate || 0) * bookingsCount} kr`,
      icon: DollarSign,
      trend: "+8%",
    },
    {
      label: "Betyg",
      value: "4.8",
      icon: Star,
      sub: "/5.0",
    },
  ];

  const todaysClasses = [
    { title: "Salsa Nybörjare", time: "10:00 - 11:30", students: 12, status: "Pågår" },
    { title: "Bachata Medel", time: "13:00 - 14:30", students: 8, status: "Kommande" },
    { title: "Street Dance", time: "17:00 - 18:30", students: 15, status: "Kommande" },
  ];

  const recentBookings = [
    { name: "Anna Eriksson", service: "Privat Salsalektion", time: "Igår", status: "Bekräftad" },
    { name: "Johan Berg", service: "Gruppklass Bachata", time: "2 dagar sedan", status: "Ny" },
    { name: "Lisa Holm", service: "Street Dance Workshop", time: "3 dagar sedan", status: "Bekräftad" },
  ];

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
            {stat.trend && (
              <div className="mt-1 flex items-center gap-0.5">
                <TrendingUp size={10} className="text-green-400" />
                <span className="text-[10px] text-green-400">{stat.trend}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Today's Classes */}
      <section>
        <h2 className="mb-4 text-lg font-bold">Dagens Klasser</h2>
        <div className="space-y-3">
          {todaysClasses.map((cls, i) => (
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
                <div className="flex items-center gap-1 text-xs text-[var(--usha-muted)]">
                  <Users size={10} />
                  <span>{cls.students}</span>
                </div>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    cls.status === "Pågår"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
                  }`}
                >
                  {cls.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Bookings */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Senaste Bokningar</h2>
          <Link href="/app/calendar" className="text-xs text-[var(--usha-gold)]">
            Visa alla
          </Link>
        </div>
        <div className="space-y-3">
          {recentBookings.map((booking, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <span className="text-sm font-bold text-[var(--usha-gold)]">
                  {booking.name[0]}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{booking.name}</h3>
                <p className="text-xs text-[var(--usha-muted)]">
                  {booking.service}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    booking.status === "Ny"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {booking.status}
                </span>
                <p className="mt-0.5 text-[10px] text-[var(--usha-muted)]">
                  {booking.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Upplevelse (Venue/Experience) Home ─── */
function UpplevelseHome({
  profile,
  bookingsCount,
}: {
  profile: any;
  bookingsCount: number;
}) {
  const stats = [
    { label: "Bokningar", value: String(bookingsCount), icon: Calendar, trend: "+18%" },
    { label: "Besökare", value: "342", icon: Users, trend: "+24%" },
    { label: "Intäkter", value: "45,200 kr", icon: DollarSign, trend: "+15%" },
  ];

  const upcomingEvents = [
    { title: "Latin Night", date: "15 feb, 21:00", capacity: "120/150", status: "Aktiv" },
    { title: "Wine & Jazz", date: "18 feb, 19:00", capacity: "45/60", status: "Aktiv" },
    { title: "Wellness Retreat", date: "22 feb, 09:00", capacity: "18/20", status: "Nästan full" },
  ];

  const activeCreators = [
    { name: "Maria Lindström", type: "Dansinstruktör", sessions: 8 },
    { name: "Erik Johansson", type: "DJ & Musiker", sessions: 4 },
    { name: "Sofia Andersson", type: "Yogainstruktör", sessions: 6 },
  ];

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
            <div className="mt-1 flex items-center gap-0.5">
              <TrendingUp size={10} className="text-green-400" />
              <span className="text-[10px] text-green-400">{stat.trend}</span>
            </div>
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
        <div className="space-y-3">
          {upcomingEvents.map((event, i) => (
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
                <p className="text-xs font-medium">{event.capacity}</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    event.status === "Nästan full"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Active Creators */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Aktiva Kreatörer</h2>
          <span className="text-xs text-[var(--usha-gold)]">Bjud in</span>
        </div>
        <div className="space-y-3">
          {activeCreators.map((creator, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--usha-gold)]/30 bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <span className="text-sm font-bold text-[var(--usha-gold)]">
                  {creator.name[0]}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{creator.name}</h3>
                <p className="text-xs text-[var(--usha-muted)]">{creator.type}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium">{creator.sessions} sessioner</p>
                <p className="text-[10px] text-[var(--usha-muted)]">denna månad</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
