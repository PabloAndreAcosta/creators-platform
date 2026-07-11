import { createClient } from "@/lib/supabase/server";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://usha.se";
  const supabase = await createClient();

  // Static pages — only real, content-rich, indexable pages.
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/for-kreatorer`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/for-platser`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/for-publik`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/upplevelser`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/marketplace`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/flode`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.7 },
    { url: `${baseUrl}/om`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Public creator profiles
  const { data: creators } = await supabase
    .from("profiles")
    .select("id, slug, updated_at")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(500);

  const creatorPages: MetadataRoute.Sitemap = (creators || []).map((c) => ({
    url: `${baseUrl}/creators/${c.slug || c.id}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Active listings
  const { data: listings } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(1000);

  const listingPages: MetadataRoute.Sitemap = (listings || []).map((l) => ({
    url: `${baseUrl}/listing/${l.slug || l.id}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // City landing pages — only cities that actually have content, derived from
  // the real city column (not the raw address, which starts with the venue).
  const { data: listingCities } = await supabase
    .from("listings")
    .select("event_city")
    .eq("is_active", true)
    .eq("is_public", true)
    .not("event_city", "is", null);

  const upplevelserCitySet = new Set<string>();
  (listingCities || []).forEach((l) => {
    const c = l.event_city?.trim().toLowerCase();
    if (c) upplevelserCitySet.add(c);
  });

  const { data: creatorCities } = await supabase
    .from("profiles")
    .select("location")
    .eq("is_public", true)
    .not("location", "is", null);

  const creatorCitySet = new Set<string>();
  (creatorCities || []).forEach((p) => {
    const c = p.location?.trim().toLowerCase();
    if (c) creatorCitySet.add(c);
  });

  const cityPages: MetadataRoute.Sitemap = [
    ...Array.from(upplevelserCitySet).map((city) => ({
      url: `${baseUrl}/upplevelser/${encodeURIComponent(city)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...Array.from(creatorCitySet).map((city) => ({
      url: `${baseUrl}/creators/stad/${encodeURIComponent(city)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  return [...staticPages, ...creatorPages, ...listingPages, ...cityPages];
}
