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
 */
export async function generateUniqueListingSlug(
  supabase: SupabaseClient,
  title: string,
  opts: { excludeId?: string; taken?: Set<string> } = {}
): Promise<string> {
  const base = slugifyTitle(title) || "event";
  const { excludeId, taken } = opts;

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
