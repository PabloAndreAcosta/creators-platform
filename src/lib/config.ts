/**
 * Admin check — uses email as fallback for client-side checks.
 * Server-side code should prefer checking profiles.is_admin column.
 */
const ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
  process.env.ADMIN_EMAILS ||
  "pablo.andre.acosta@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
