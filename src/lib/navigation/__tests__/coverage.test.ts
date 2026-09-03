import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { APP_DESTINATIONS, ADMIN_DESTINATIONS, ADMIN_ROOT, CONTEXTUAL_ROUTES } from "../registry";

// Vakten mot föräldralösa sidor.
//
// Upprepade gånger har färdiga sidor blivit osynliga för att någon glömde
// lägga till dem i en av appens parallella menyer — Kopplingar, Login &
// säkerhet, bokningsvyn, gig-marknaden. Det här testet gör den glömskan till
// ett rött bygge i stället för en funktion ingen hittar.
//
// Lägger du till en sida måste du antingen sätta den i APP_DESTINATIONS (den
// får en menyingång), i ADMIN_DESTINATIONS (den hamnar i adminmenyn) eller i
// CONTEXTUAL_ROUTES med ett skäl (den nås från ett objekt eller mitt i ett
// flöde). Alla tre är giltiga svar. Att inte svara är det som failar.

const APP_DIR = path.join(process.cwd(), "src", "app");

function routeFromFile(file: string): string {
  const rel = file.slice(APP_DIR.length).replace(/\/page\.tsx$/, "");
  // Route groups som (dashboard) syns inte i URL:en.
  const route = rel.replace(/\/\([^)]+\)/g, "");
  return route || "/";
}

function findPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findPages(full));
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

/** Sidor bakom inloggning: /app/** och route-gruppen (dashboard). */
function loggedInPages(): string[] {
  const roots = [path.join(APP_DIR, "app"), path.join(APP_DIR, "(dashboard)")];
  return roots.filter(fs.existsSync).flatMap(findPages);
}

describe("navigationsregistret täcker varje inloggad sida", () => {
  const routes = loggedInPages().map(routeFromFile).sort();
  const declared = new Set([
    ...APP_DESTINATIONS.map((d) => d.path),
    ...ADMIN_DESTINATIONS.map((d) => d.path),
    ADMIN_ROOT,
  ]);
  const contextual = new Set(Object.keys(CONTEXTUAL_ROUTES));

  it("hittar sidorna överhuvudtaget (skyddar mot att testet tystnar)", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it("varje sida har antingen menyingång eller ett skäl att sakna den", () => {
    const undeclared = routes.filter((r) => !declared.has(r) && !contextual.has(r));

    expect(
      undeclared,
      undeclared.length
        ? `Dessa sidor går inte att nå från någon meny:\n` +
            undeclared.map((r) => `  ${r}`).join("\n") +
            `\n\nLägg till i APP_DESTINATIONS för en menyingång, i ` +
            `ADMIN_DESTINATIONS för adminmenyn, eller i CONTEXTUAL_ROUTES med ` +
            `skälet till att den nås från ett objekt/flöde.`
        : undefined
    ).toEqual([]);
  });

  it("registret pekar inte på sidor som inte finns", () => {
    const known = new Set(routes);
    const dangling = APP_DESTINATIONS.filter(
      (d) => !d.external && !known.has(d.path)
    ).map((d) => d.path);

    expect(
      dangling,
      dangling.length
        ? `Registret listar rutter utan page.tsx:\n${dangling.map((r) => `  ${r}`).join("\n")}`
        : undefined
    ).toEqual([]);
  });

  it("kontextuella rutter finns också på riktigt", () => {
    const known = new Set(routes);
    const dangling = Object.keys(CONTEXTUAL_ROUTES).filter((r) => !known.has(r));
    expect(dangling, `CONTEXTUAL_ROUTES pekar på rutter som saknas: ${dangling.join(", ")}`).toEqual([]);
  });

  it("varje kontextuell rutt har ett läsbart skäl", () => {
    const thin = Object.entries(CONTEXTUAL_ROUTES)
      .filter(([, reason]) => reason.trim().length < 10)
      .map(([route]) => route);
    expect(thin, `Skälet säger inget: ${thin.join(", ")}`).toEqual([]);
  });

  it("ingen destination är deklarerad två gånger", () => {
    const seen = new Map<string, number>();
    for (const d of APP_DESTINATIONS) seen.set(d.path, (seen.get(d.path) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p);
    expect(dupes, `Dubblerade rutter: ${dupes.join(", ")}`).toEqual([]);
  });

  it("allt som renderas i en lista har en etikett", () => {
    // Mer-griden och sidomenyn läser labelKey respektive navLabelKey. Saknas de
    // renderar next-intl felmeddelandet rakt ut till användaren.
    const missing = APP_DESTINATIONS.filter(
      (d) =>
        (d.surfaces.includes("more") || d.surfaces.includes("sidebar")) && !d.labelKey
    ).map((d) => d.path);
    expect(missing, `Renderas utan labelKey: ${missing.join(", ")}`).toEqual([]);

    const missingNav = APP_DESTINATIONS.filter(
      (d) => d.surfaces.includes("sidebar") && !d.navLabelKey
    ).map((d) => d.path);
    expect(missingNav, `Ligger i sidomenyn utan navLabelKey: ${missingNav.join(", ")}`).toEqual([]);
  });

  it("varje destination visas på minst en yta", () => {
    const homeless = APP_DESTINATIONS.filter((d) => d.surfaces.length === 0).map((d) => d.path);
    expect(homeless, `Destination utan yta blir osynlig: ${homeless.join(", ")}`).toEqual([]);
  });
});

describe("Utbud är en ingång, inte en återvändsgränd", () => {
  it("allt som bara ligger på Utbud nås via Utbud-sidan", () => {
    // Utbud-ytan finns för att Tjänster, Produkter, Kurser och gig-sidorna
    // skulle sluta ta var sin rad i menyerna. Det fungerar bara så länge
    // /app/sell själv står i en meny — annars har de fyra ingen väg alls.
    const sellOnly = APP_DESTINATIONS.filter(
      (d) => d.surfaces.includes("sell") && !d.surfaces.some((s) => s === "sidebar" || s === "more")
    );
    const hub = APP_DESTINATIONS.find((d) => d.path === "/app/sell");
    expect(
      hub && (hub.surfaces.includes("sidebar") || hub.surfaces.includes("more")),
      `${sellOnly.length} destinationer nås bara via Utbud, och Utbud står inte i någon meny.`
    ).toBe(true);
  });

  it("den som ser en Utbud-destination ser också Utbud", () => {
    // En roll som når t.ex. Produkter men inte Utbud ser en sida hon inte kan
    // komma till. Rollerna måste följas åt.
    const hub = APP_DESTINATIONS.find((d) => d.path === "/app/sell")!;
    const hubRoles = hub.roles === "all" ? ["customer", "creator", "venue"] : hub.roles;
    const orphaned = APP_DESTINATIONS.filter((d) => {
      if (!d.surfaces.includes("sell") || d.path === "/app/sell") return false;
      const roles = d.roles === "all" ? ["customer", "creator", "venue"] : d.roles;
      return roles.some((r) => !hubRoles.includes(r as never));
    }).map((d) => d.path);
    expect(orphaned, `Syns på Utbud för en roll som inte når Utbud: ${orphaned.join(", ")}`).toEqual([]);
  });
});

describe("desktop tappar inte bort destinationer", () => {
  it("allt en kreatör når i Mer-griden går också att nå på desktop", () => {
    // Mer-griden är md:hidden. Ligger något BARA där är det osynligt på
    // desktop — precis det som gjorde favoriter och analys onåbara.
    // Sidomenyn behöver inte lista allt, men den måste nå Mer-sidan själv.
    const sidebarPaths = new Set(
      APP_DESTINATIONS.filter((d) => d.surfaces.includes("sidebar")).map((d) => d.path)
    );
    const moreOnly = APP_DESTINATIONS.filter(
      (d) => d.surfaces.includes("more") && !d.surfaces.includes("sidebar")
    );

    // Kravet: sidomenyn måste innehålla en väg till Mer-griden, annars är
    // more-only-destinationerna oåtkomliga på desktop.
    const reachesMore = sidebarPaths.has("/app/tools");
    expect(
      reachesMore || moreOnly.length === 0,
      `${moreOnly.length} destinationer finns bara i Mer-griden, och sidomenyn ` +
        `saknar väg dit. På desktop blir de omöjliga att nå.`
    ).toBe(true);
  });
});
