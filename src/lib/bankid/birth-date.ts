/**
 * Födelsedatum från BankID, som "ÅÅÅÅ-MM-DD", eller null.
 *
 * Personnumret sparas bara som hash, så åldern måste komma härifrån. Ett värde
 * som inte går att tolka sparas inte alls — hellre ingen ålder (och en ny
 * verifiering) än en felaktig.
 */
export function birthDateOrNull(value: string | null | undefined): string | null {
  const m = (value ?? "").trim().match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Ålder i hela år på ett datum ("ÅÅÅÅ-MM-DD"). */
export function ageOnDate(birthDate: string, date: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
