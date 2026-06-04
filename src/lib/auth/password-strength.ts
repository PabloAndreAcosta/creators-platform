export const MIN_PASSWORD_LENGTH = 8;

/** SHA-1 of `text` as an uppercase hex string, via the Web Crypto API. */
async function sha1HexUpper(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Checks a password against the HaveIBeenPwned "Pwned Passwords" range API
 * using k-anonymity: only the first 5 chars of the SHA-1 hash are ever sent —
 * never the password or the full hash. The "Add-Padding" header obscures the
 * real result count.
 *
 * Fails OPEN: any network error, non-2xx response, or exception returns false
 * so this can never block a signup/reset. (Supabase Pro's server-side check is
 * the authoritative backstop; this is a fast inline UX layer.)
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const hash = await sha1HexUpper(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body
      .split("\n")
      .some((line) => line.split(":")[0].trim() === suffix);
  } catch {
    return false; // fail open — never block on a transient HIBP failure
  }
}
