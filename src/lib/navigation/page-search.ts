import { APP_DESTINATIONS } from "./registry";

/**
 * Sökord som inte står i sidans namn men som folk faktiskt skriver.
 * Paulina letade efter "referral"/"bjud in" och hittade aldrig Partnerprogram.
 */
const ALIASES: Record<string, string[]> = {
  "/app/partner": [
    "bjud in", "bjuda in", "inbjudan", "värva", "värvning", "tipsa", "referral", "refer",
    "invite", "invitar", "referido", "partner",
  ],
};

export interface PageHit {
  path: string;
  label: string;
  desc: string;
}

const norm = (s: string) => s.toLocaleLowerCase("sv").normalize("NFC").trim();

/**
 * Appsidor som matchar sökningen: alla rollers sidor i Mer-griden, sökta på
 * namn, beskrivning och synonymer. `tr` översätter en toolsPage-nyckel.
 */
export function matchPages(query: string, tr: (key: string) => string, limit = 4): PageHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const hits: PageHit[] = [];
  for (const d of APP_DESTINATIONS) {
    if (d.roles !== "all" || !d.surfaces.includes("more") || !d.labelKey || d.external) continue;
    const label = tr(d.labelKey);
    const desc = d.descKey ? tr(d.descKey) : "";
    const hay = [label, desc, ...(ALIASES[d.path] ?? [])].map(norm);
    if (hay.some((h) => h.includes(q) || (q.length >= 4 && q.includes(h) && h.length >= 4))) {
      hits.push({ path: d.path, label, desc });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}
