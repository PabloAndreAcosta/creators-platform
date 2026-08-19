import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_DESTINATIONS, ADMIN_ROOT } from "../registry";

const APP_DIR = path.join(process.cwd(), "src", "app");
const ADMIN_DIR = path.join(APP_DIR, "(dashboard)", "dashboard", "admin");
const LOCALES = ["sv", "en", "es"] as const;

function pageFileFor(route: string): string {
  // Route groups like (dashboard) don't appear in the URL.
  return path.join(APP_DIR, "(dashboard)", `${route}`, "page.tsx");
}

function adminPages(dir = ADMIN_DIR, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) adminPages(full, out);
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

describe("adminmenyn pekar på sidor som finns", () => {
  it("har ett nav att hänga verktygen under", () => {
    expect(fs.existsSync(pageFileFor(ADMIN_ROOT))).toBe(true);
  });

  for (const dest of ADMIN_DESTINATIONS) {
    it(`${dest.path} har en page.tsx`, () => {
      expect(fs.existsSync(pageFileFor(dest.path))).toBe(true);
    });
  }

  it("varje verktyg har etikett och beskrivning på alla språk", () => {
    const missing: string[] = [];
    for (const locale of LOCALES) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")
      );
      const ns = messages.adminPage ?? {};
      for (const dest of ADMIN_DESTINATIONS) {
        for (const key of [dest.labelKey, dest.descKey]) {
          if (ns[key] == null) missing.push(`${locale}: adminPage.${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("adminsidorna är skyddade", () => {
  // The tools used to be reachable only by typing their URL, which quietly did
  // some of the work. Now that a menu points at them, the server-side check is
  // the only thing standing between a curious user and an admin tool — so a new
  // page that forgets it fails the build rather than shipping open.
  const pages = adminPages();

  it("hittar adminsidorna överhuvudtaget (skyddar mot att testet tystnar)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(ADMIN_DESTINATIONS.length + 1);
  });

  for (const file of pages) {
    const rel = file.slice(process.cwd().length + 1);
    it(`${rel} kontrollerar is_admin på servern`, () => {
      const src = fs.readFileSync(file, "utf8");
      expect(src, `${rel} saknar isAdminById-kontroll`).toContain("isAdminById");
      expect(src, `${rel} kontrollerar men släpper igenom`).toMatch(/redirect\(/);
    });
  }
});

describe("adminytan är läsbar för en partner som inte kan svenska", () => {
  // Admin used to be Pablo alone, so Swedish-only was fine. Partners are next,
  // and they get the same pages — so the admin surface follows the same rule as
  // the rest of the app: nothing hardcoded, everything through a key.
  //
  // The rule is "no literal visible text", not "no Swedish letters": plenty of
  // Swedish carries no å/ä/ö ("Totalt", "Ny promokod"), and a diacritic hunt
  // waves those straight through. Anything a reader can see has to arrive as an
  // expression.
  const ADMIN_SOURCES = [
    ...fs
      .readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" })
      .map((f) => path.join(ADMIN_DIR, f))
      .filter((f) => /\.tsx?$/.test(f) && fs.statSync(f).isFile()),
    path.join(process.cwd(), "src/components/admin/admin-nav.tsx"),
  ];

  /** Attributes whose value the reader sees or hears. */
  const VISIBLE_ATTRS = /(?:placeholder|title|aria-label|alt)=("([^"]*)"|'([^']*)')/g;

  function strip(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/[^\n"'`]*$/gm, "")
      .replace(/className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/gs, "")
      .replace(/style=\{\{[^}]*\}\}/gs, "");
  }

  it("hittar filerna överhuvudtaget (skyddar mot att testet tystnar)", () => {
    expect(ADMIN_SOURCES.length).toBeGreaterThan(5);
  });

  it("ingen synlig text är hårdkodad", () => {
    const offenders: string[] = [];
    for (const file of ADMIN_SOURCES) {
      const rel = file.slice(process.cwd().length + 1);
      const code = strip(fs.readFileSync(file, "utf8"));

      // JSX text nodes: what sits between tags without being an expression.
      // The character class excludes anything that can only be code — a plain
      // `>` in a comparison would otherwise pair with a later `<` and drag a
      // whole block in as if it were prose.
      for (const m of code.matchAll(/>([^<>{}();=$[\]]+)</g)) {
        const text = m[1].trim();
        if (/\p{L}{2,}/u.test(text)) offenders.push(`${rel}: >${text}<`);
      }
      for (const m of code.matchAll(VISIBLE_ATTRS)) {
        const value = (m[2] ?? m[3] ?? "").trim();
        if (/\p{L}{2,}/u.test(value)) offenders.push(`${rel}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("varje adminnamnrymd finns fylld på alla tre språk", () => {
    const NAMESPACES = ["adminPage", "adminCreators", "adminPromo", "adminPromoForm", "adminPromoTable"];
    const problems: string[] = [];
    for (const locale of LOCALES) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")
      );
      for (const ns of NAMESPACES) {
        const block = messages[ns];
        if (!block || Object.keys(block).length === 0) {
          problems.push(`${locale}: ${ns} saknas eller är tom`);
          continue;
        }
        for (const [key, value] of Object.entries(block)) {
          if (typeof value !== "string" || !value.trim()) problems.push(`${locale}: ${ns}.${key} är tom`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
