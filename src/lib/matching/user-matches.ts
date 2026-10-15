import { createAdminClient } from "@/lib/supabase/admin";

/**
 * En matchningsanledning som nyckel plus ev. värde, aldrig färdig text.
 *
 * Anledningarna var hårdkodad svenska ("Inom 14 dagar", "BankID-verifierad"),
 * så en besökare med engelska eller spanska valt fick svenska etiketter mitt
 * i sitt flöde. Samma regel som för notiser och mejl gäller här: servern
 * skickar nyckel och parametrar, klienten sätter språket.
 *
 * `value` bär det som inte går att översätta — ett ortnamn, ett betyg, en
 * dansstil — och fylls bara i för de nycklar som har ett.
 */
export interface MatchReason {
  key: "style" | "inCity" | "within14" | "bankid" | "rating" | "popular";
  value?: string;
}

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
  match_reasons: MatchReason[];
  /** Seriens id, när kvällen tillhör en serie. Null för fristående utbud. */
  series_id: string | null;
  /** Hur många FLER tillfällen i samma serie som flödet slog ihop hit. */
  more_occurrences: number;
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
    .select("id, user_id, title, description, category, price, duration_minutes, event_tier, event_date, event_time, event_location, image_url, listing_type, created_at, series_id")
    .eq("is_active", true)
    .eq("is_public", true)
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
    const reasons: MatchReason[] = [];

    // Style (Jaccard of user styles vs the listing's category)
    const listingStyles = new Set<string>([norm(l.category)].filter(Boolean));
    const styleScore = jaccard(userStyles, listingStyles);
    if (styleScore > 0) reasons.push({ key: "style", value: pretty(l.category) });

    // Geo (city-name match; distance decay needs user coords — future)
    let geoScore = 0.3;
    const loc = norm(l.event_location || "");
    if (userCity && loc && loc.includes(userCity)) { geoScore = 1; reasons.push({ key: "inCity", value: l.event_location ?? "" }); }

    // Level (neutral when unknown; slight alignment for courses when user set a level)
    const levelScore = hasSkill && (l.listing_type === "course" || l.listing_type === "kurs") ? 0.6 : 0.4;

    // Recency (upcoming events boosted; past stays browsable but deprioritized)
    let recencyScore = 0.2;
    if (l.event_date) {
      const d = new Date(l.event_date);
      const days = Math.round((d.getTime() - today.getTime()) / 86400_000);
      if (days >= 0 && days <= 14) { recencyScore = 1; reasons.push({ key: "within14" }); }
      else if (days > 14 && days <= 30) recencyScore = 0.6;
      else if (days >= 0) recencyScore = 0.45;
    }

    // Trust (BankID + good ratings)
    let trustScore = 0;
    if (creator?.bankid_verified_at) { trustScore += 0.6; reasons.push({ key: "bankid" }); }
    const ra = ratingAgg.get(l.user_id);
    if (ra && ra.n > 0) {
      const avg = ra.sum / ra.n;
      if (avg >= 4) { trustScore += 0.4; reasons.push({ key: "rating", value: avg.toFixed(1) }); }
      else trustScore += 0.15;
    }
    trustScore = Math.min(1, trustScore);

    // Popularity (log-scaled bookings in last 30d)
    const pop = popMap.get(l.id) ?? 0;
    const popScore = Math.min(1, Math.log(1 + pop) / Math.log(1 + 10));
    if (pop >= 3) reasons.push({ key: "popular" });

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
      series_id: (l as { series_id?: string | null }).series_id ?? null,
      more_occurrences: 0,
    };
  });

  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return collapseSeries(scored, today).slice(0, limit);
}

/**
 * Slå ihop en series tillfällen till EN träff.
 *
 * Varje kväll är en egen rad i listings, så en serie med åtta tillfällen kunde
 * lägga beslag på halva flödet med samma titel om och om igen. Den publika
 * sidan grupperar redan ("15 okt. · 4 tillfällen till"); rekommendationerna
 * ärvde ingenting av det.
 *
 * Vilket tillfälle som får representera serien avgörs av datumet, inte av
 * poängen: det är nästa kommande kväll man vill bli erbjuden. Saknar serien
 * kommande kvällar faller valet på den senast passerade, så att ett äldre
 * utbud fortfarande går att bläddra fram (gamla kvällar är medvetet kvar).
 * Gruppen behåller den HÖGSTA poängen bland sina tillfällen, så att
 * ihopslagningen aldrig trycker ner en serie i rangordningen.
 *
 * Fristående utbud utan series_id grupperas aldrig — de är sig själva.
 */
export function collapseSeries(matches: readonly UserMatch[], today: Date): UserMatch[] {
  const groups = new Map<string, UserMatch[]>();
  const order: string[] = [];

  for (const m of matches) {
    // Nyckeln måste vara unik för ett fristående utbud, annars skulle alla
    // utbud utan serie hamna i samma hög och nio av tio försvinna.
    const key = m.series_id ? `s:${m.series_id}` : `l:${m.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(m);
    else { groups.set(key, [m]); order.push(key); }
  }

  const out: UserMatch[] = [];
  for (const key of order) {
    const bucket = groups.get(key)!;
    const best = { ...pickOccurrence(bucket, today) };
    best.score = Math.max(...bucket.map((m) => m.score));
    best.more_occurrences = bucket.length - 1;
    out.push(best);
  }

  // Poängen kan ha lyfts av en syskonkväll, så ordningen måste sättas om.
  out.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return out;
}

/** Nästa kommande tillfälle; annars det senast passerade. */
function pickOccurrence(bucket: readonly UserMatch[], today: Date): UserMatch {
  const t = today.getTime();
  const dated = bucket.filter((m) => m.event_date);
  if (dated.length === 0) return bucket[0];

  const upcoming = dated
    .filter((m) => new Date(m.event_date!).getTime() >= t)
    .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime());
  if (upcoming.length > 0) return upcoming[0];

  return dated.sort((a, b) => new Date(b.event_date!).getTime() - new Date(a.event_date!).getTime())[0];
}
