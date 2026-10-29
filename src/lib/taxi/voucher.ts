/**
 * Matkupongen: restaurangen löser in med en kod och slår in beloppet.
 *
 * Koden hindrar att vem som helst trycker "Lös in" på volontärens telefon.
 * Beloppet får inte överstiga taket (standard 100 kr) och sparas för att
 * arrangören ska kunna stämma av mot restaurangens nota vid kvällens slut.
 * Rena funktioner.
 */

export const DEFAULT_VOUCHER_MAX_ORE = 10_000;

/** 4–6 siffror. */
export function isValidVoucherCode(code: string): boolean {
  return /^[0-9]{4,6}$/.test(code);
}

/** Jämför koder utan att svarstiden avslöjar hur många tecken som stämde. */
export function codesMatch(given: string, stored: string): boolean {
  const a = given.trim();
  if (a.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

/**
 * Beloppet restaurangen slår in, i kronor med komma eller punkt. Ger öre,
 * eller null om det inte går att tolka eller överstiger taket.
 */
export function parseVoucherAmount(input: string, maxOre: number): number | null {
  const n = Number(input.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const ore = Math.round(n * 100);
  return ore <= maxOre ? ore : null;
}

/** Var kupongens inställning bor: serien om kvällen har en, annars kvällen. */
export function voucherScopeId(evening: { id: string; series_id: string | null }): string {
  return evening.series_id ?? evening.id;
}
