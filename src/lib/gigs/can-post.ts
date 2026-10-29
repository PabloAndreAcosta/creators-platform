/**
 * Vem som får lägga ut uppdrag: lokaler OCH kreatörer. En kreatör som håller
 * egna kvällar anlitar dansare precis som en lokal gör — det är inte alltid
 * lokalen som arrangerar. Måste hållas i synk med RLS-policyn på public.gigs.
 */
export const GIG_POSTER_ROLES = ["creator", "venue"] as const;

export function canPostGigs(role: string | null | undefined): boolean {
  return (GIG_POSTER_ROLES as readonly string[]).includes(role ?? "");
}
