/**
 * Får inlägget visas i flödet?
 *
 * /flode visade inlägg från dolda konton med "?"-avatar och namnet "Kreatör",
 * och länken till /creators/<id> gav 404. Samma villkor som /creators/[id]:
 * profilen måste finnas och vara publik (is_public). Raderade konton döljs av
 * samma skäl — kontoraderingen sätter is_public = false, och RLS släpper då
 * inte igenom profilen, så den kommer tillbaka som null.
 *
 * Undantag: den inloggades egna inlägg, så att den som är dold fortfarande ser
 * vad hen själv har skrivit.
 */
export function isFeedPostVisible(
  post: { user_id: string; profiles?: { is_public?: boolean | null } | null },
  viewerId?: string | null
): boolean {
  if (viewerId && post.user_id === viewerId) return true;
  return post.profiles?.is_public === true;
}
