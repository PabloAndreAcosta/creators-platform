import { createClient } from "@/lib/supabase/server";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://usha.se";
  const supabase = await createClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/flode`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/marketplace`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/platser`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
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
    .order("updated_at", { ascending: false })
    .limit(1000);

  const listingPages: MetadataRoute.Sitemap = (listings || []).map((l) => ({
    url: `${baseUrl}/listing/${l.slug || l.id}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Location landing pages
  const { data: locationProfiles } = await supabase
    .from("profiles")
    .select("location")
    .eq("is_public", true)
    .not("location", "is", null);

  const locationSet = new Set<string>();
  (locationProfiles || []).forEach((p) => {
    const loc = p.location?.trim();
    if (loc) locationSet.add(loc);
  });
  const uniqueLocations = Array.from(locationSet);

  // Extract city names for landing pages
  const citySet = new Set<string>();
  uniqueLocations.forEach((loc) => {
    const city = loc.split(",")[0].trim();
    if (city) citySet.add(city.toLowerCase());
  });
  const cities = Array.from(citySet);

  const locationPages: MetadataRoute.Sitemap = cities.flatMap((city) => [
    { url: `${baseUrl}/upplevelser/${encodeURIComponent(city)}`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${baseUrl}/creators/stad/${encodeURIComponent(city)}`, changeFrequency: "daily" as const, priority: 0.7 },
  ]);

  // Upplevelser main page
  const upplevelserPage: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/upplevelser`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
  ];

  // Venues
  const { data: venues } = await supabase
    .from("venues")
    .select("id")
    .limit(500);

  const venuePages: MetadataRoute.Sitemap = (venues || []).map((v) => ({
    url: `${baseUrl}/platser/${v.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...upplevelserPage, ...creatorPages, ...listingPages, ...locationPages, ...venuePages];
}
