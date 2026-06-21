/**
 * Builds a navigable Facebook permalink from a stored post id.
 *
 * Facebook page-post ids are stored as `"{pageId}_{postId}"`. A URL of the form
 * `facebook.com/{pageId}_{postId}` does NOT open the post — the navigable form is
 * `facebook.com/{pageId}/posts/{postId}`. (When available, prefer the Graph API's
 * `permalink_url`, which also handles New-Pages-Experience ids.)
 */
export function facebookPostUrl(storedId: string): string {
  const i = storedId.indexOf("_");
  if (i > 0) {
    const pageId = storedId.slice(0, i);
    const postId = storedId.slice(i + 1);
    return `https://www.facebook.com/${pageId}/posts/${postId}`;
  }
  return `https://www.facebook.com/${storedId}`;
}
