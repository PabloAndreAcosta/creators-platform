import { isKioskPath } from "@/lib/tickets/kiosk-path";

/**
 * Var felknappen inte ska synas.
 *
 * - Kiosken och dörren (/sjalvinslapp/*, /app/dorr/*): plattan står vänd mot
 *   gästerna i en kö. En knapp i hörnet är något en främling trycker på, och den
 *   ligger över helskärmsvyn.
 * - Entrén (/app/events/<id>/entre): dörrvärdens försäljningsskärm, samma skäl.
 * - Läsaren (/app/lyssna): spelarlisten ligger fast ovanför bottenmenyn, precis
 *   där knappen annars sitter.
 *
 * Felsidorna visar sin egen, stora knapp och påverkas inte av listan.
 */
export function isFeedbackHiddenPath(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  if (isKioskPath(p)) return true;
  if (/^\/app\/events\/[^/]+\/entre(\/|$)/.test(p)) return true;
  if (p === "/app/lyssna" || p.startsWith("/app/lyssna/")) return true;
  return false;
}

/** Bottenmenyn finns bara i /app (mobil). Där lyfts knappen över den. */
export function hasBottomNav(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return p === "/app" || p.startsWith("/app/");
}
