import { createAdminClient } from "@/lib/supabase/admin";

export interface UserMatch {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  event_tier: string;
  event_date: string | null;
  event_location: string | null;
  image_url: string | null;
  listing_type: string | null;
  created_at: string;
  creator: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  bookingCount: number;
  score: number;
  match_reasons: string[];
}

const WEIGHTS = { style: 40, geo: 20, level: 15, recency: 10, trust: 10, pop: 5 };
const ACTIVE_BOOKING = ["pending", "confirmed", "completed"];

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => { if (b.has(x)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const norm = (s: string) => s.trim().toLowerCase();
const STYLE_LABEL: Record<string, string> = {
  kizomba: "Kizomba", "urban kiz": "Urban Kiz", bachata: "Bachata",
  salsa: "Salsa", afrobeats: "Afrobeats", zouk: "Zouk", tango: "Tango",
};
const pretty = (s: string) => STYLE_LABEL[norm(s)] ?? s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Rule-based "För dig" matches for a user. All ranking is server-side; the
 * client only ever receives the already-ranked, public-safe payload.
 *
 * Degrades gracefully: with no preferences/styles the style term is 0 and the
 * result is effectively "upcoming, nearby & popular" — so a brand-new user
 * still gets a non-empty feed (acceptance #1).
 */
export async function getUserMatches(userId: string, limit = 10): Promise<UserMatch[]> {
  const admin = createAdminClient();

  const [{ data: prefs }, { data: profile }, { data: myBookings }] = await Promise.all([
    admin.from("profile_preferences").select("dance_styles, skill_level, city").eq("profile_id", userId).maybeSingle(),
    admin.from("profiles").select("dance_styles, location").eq("id", userId).maybeSingle(),
    admin.from("bookings").select("listing_id").eq("customer_id", userId).in("status", ACTIVE_BOOKING),
  ]);

  const userStyles = new Set<string>(
    [...(prefs?.dance_styles ?? []), ...(profile?.dance_styles ?? [])].map(norm).filter(Boolean)
  );
  const userCity = norm(prefs?.city || profile?.location || "");
  const hasSkill = !!prefs?.skill_level;
  const booked = new Set<string>((myBookings ?? []).map((b) => b.listing_id));

  const { data: candidates } = await admin
    .from("listings")
    .select("id, user_id, title, description, category, price, duration_minutes, event_tier, event_date, event_time, event_location, image_url, listing_type, created_at")
    .eq("is_active", true)
    .limit(120);

  const pool = (candidates ?? []).filter((l) => !booked.has(l.id));
  if (pool.length === 0) return [];

  const listingIds = pool.map((l) => l.id);
  const creatorIds = Array.from(new Set(pool.map((l) => l.user_id)));
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [{ data: creators }, { data: recentBookings }, { data: reviews }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url, bankid_verified_at, location").in("id", creatorIds),
    admin.from("bookings").select("listing_id").in("listing_id", listingIds).in("status", ACTIVE_BOOKING).gte("created_at", since30),
    admin.from("reviews").select("creator_id, rating").in("creator_id", creatorIds),
  ]);

  const creatorMap = new Map((creators ?? []).map((c) => [c.id, c]));
  const popMap = new Map<string, number>();
  for (const b of recentBookings ?? []) popMap.set(b.listing_id, (popMap.get(b.listing_id) ?? 0) + 1);
  const ratingAgg = new Map<string, { sum: number; n: number }>();
  for (const r of reviews ?? []) {
    const a = ratingAgg.get(r.creator_id) ?? { sum: 0, n: 0 };
    a.sum += r.rating; a.n += 1; ratingAgg.set(r.creator_id, a);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const scored: UserMatch[] = pool.map((l) => {
    const creator = creatorMap.get(l.user_id);
    const reasons: string[] = [];

    // Style (Jaccard of user styles vs the listing's category)
    const listingStyles = new Set<string>([norm(l.category)].filter(Boolean));
    const styleScore = jaccard(userStyles, listingStyles);
    if (styleScore > 0) reasons.push(pretty(l.category));

    // Geo (city-name match; distance decay needs user coords — future)
    let geoScore = 0.3;
    const loc = norm(l.event_location || "");
    if (userCity && loc && loc.includes(userCity)) { geoScore = 1; reasons.push(`I ${l.event_location}`); }

    // Level (neutral when unknown; slight alignment for courses when user set a level)
    const levelScore = hasSkill && (l.listing_type === "course" || l.listing_type === "kurs") ? 0.6 : 0.4;

    // Recency (upcoming events boosted; past stays browsable but deprioritized)
    let recencyScore = 0.2;
    if (l.event_date) {
      const d = new Date(l.event_date);
      const days = Math.round((d.getTime() - today.getTime()) / 86400_000);
      if (days >= 0 && days <= 14) { recencyScore = 1; reasons.push("Inom 14 dagar"); }
      else if (days > 14 && days <= 30) recencyScore = 0.6;
      else if (days >= 0) recencyScore = 0.45;
    }

    // Trust (BankID + good ratings)
    let trustScore = 0;
    if (creator?.bankid_verified_at) { trustScore += 0.6; reasons.push("BankID-verifierad"); }
    const ra = ratingAgg.get(l.user_id);
    if (ra && ra.n > 0) {
      const avg = ra.sum / ra.n;
      if (avg >= 4) { trustScore += 0.4; reasons.push(`${avg.toFixed(1)}★`); }
      else trustScore += 0.15;
    }
    trustScore = Math.min(1, trustScore);

    // Popularity (log-scaled bookings in last 30d)
    const pop = popMap.get(l.id) ?? 0;
    const popScore = Math.min(1, Math.log(1 + pop) / Math.log(1 + 10));
    if (pop >= 3) reasons.push("Populärt nu");

    const score =
      WEIGHTS.style * styleScore +
      WEIGHTS.geo * geoScore +
      WEIGHTS.level * levelScore +
      WEIGHTS.recency * recencyScore +
      WEIGHTS.trust * trustScore +
      WEIGHTS.pop * popScore;

    return {
      id: l.id,
      title: l.title,
      description: l.description,
      category: l.category,
      price: l.price,
      duration_minutes: l.duration_minutes,
      event_tier: l.event_tier,
      event_date: l.event_date ?? null,
      event_location: l.event_location ?? null,
      image_url: l.image_url ?? null,
      listing_type: l.listing_type ?? null,
      created_at: l.created_at,
      creator: { id: l.user_id, name: creator?.full_name ?? null, avatar: creator?.avatar_url ?? null },
      bookingCount: pop,
      score,
      match_reasons: reasons.slice(0, 3),
    };
  });

  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return scored.slice(0, limit);
}
