import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turn an event/listing title into a URL-safe slug.
 * Strips accents (å→a, ä→a, ö→o, é→e …), lowercases, and collapses any run of
 * non-alphanumerics into single hyphens. Capped at 60 chars so URLs stay sane.
 */
export function slugifyTitle(title: string): string {
  return (title || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Generate a slug for a listing title that is unique against the partial unique
 * index on `listings.slug` (unique where slug is not null). Appends `-2`, `-3`,
 * … on collision, falling back to a random suffix.
 *
 * @param opts.excludeId  ignore this listing's own row (for updates).
 * @param opts.taken      slugs already claimed earlier in the same batch
 *                        (e.g. a bulk import) — mutated as it hands them out.
 * @param opts.dateSuffix append a date (YYYY-MM-DD) to the base, so each
 *                        occurrence of a recurring event gets a meaningful,
 *                        self-describing slug (the-kiz-lab-2026-06-08).
 */
export async function generateUniqueListingSlug(
  supabase: SupabaseClient,
  title: string,
  opts: { excludeId?: string; taken?: Set<string>; dateSuffix?: string } = {}
): Promise<string> {
  const { excludeId, taken, dateSuffix } = opts;
  const titlePart = slugifyTitle(title) || "event";
  const base = dateSuffix ? `${titlePart}-${dateSuffix}` : titlePart;

  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    if (taken?.has(candidate)) continue;

    let query = supabase.from("listings").select("id").eq("slug", candidate).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;

    if (!data || data.length === 0) {
      taken?.add(candidate);
      return candidate;
    }
  }

  // Extremely unlikely fallback — base collided 50× in a row.
  const suffix = Math.random().toString(36).slice(2, 8);
  const candidate = `${base}-${suffix}`;
  taken?.add(candidate);
  return candidate;
}

/**
 * Slug for a recurring series' landing page (`/series/<slug>`). Many occurrence
 * rows share one series_slug, so this checks uniqueness across *distinct*
 * series (different series_id) and appends `-2`, `-3`, … on collision.
 */
export async function generateUniqueSeriesSlug(
  supabase: SupabaseClient,
  title: string
): Promise<string> {
  const base = slugifyTitle(title) || "serie";

  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const { data } = await supabase
      .from("listings")
      .select("id")
      .eq("series_slug", candidate)
      .limit(1);
    if (!data || data.length === 0) return candidate;
  }

  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
