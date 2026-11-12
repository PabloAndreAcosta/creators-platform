/**
 * Sidor som hör till kioskappen och därför länkar kioskens manifest
 * (helskärm, start i /sjalvinslapp). Hubben /app/dorr räknas med: det är där
 * plattan ställs upp, och därifrån "Lägg till på startskärmen" ska ge
 * kioskikonen, inte vanliga appen.
 */
export function isKioskPath(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return p === "/sjalvinslapp" || p.startsWith("/sjalvinslapp/") || p === "/app/dorr" || p.startsWith("/app/dorr/");
}
