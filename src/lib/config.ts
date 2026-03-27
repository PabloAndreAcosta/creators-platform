export const ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "pablo.andre.acosta@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase());

export function isAdmin(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
