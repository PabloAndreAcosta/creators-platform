import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Guardrail: the three locale files must expose the EXACT same set of keys, so a
// translation added to one language is never missing in another (which would
// render a raw i18n key to users). Values may differ (they're translations);
// only the key structure must match. See memory: never leak i18n keys.

const LOCALES = ["sv", "en", "es"] as const;
const DIR = join(process.cwd(), "src/i18n/messages");

function flatten(obj: unknown, prefix = "", out = new Set<string>()): Set<string> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
      else out.add(key);
    }
  }
  return out;
}

const keysByLocale = Object.fromEntries(
  LOCALES.map((l) => [l, flatten(JSON.parse(readFileSync(join(DIR, `${l}.json`), "utf8")))])
) as Record<(typeof LOCALES)[number], Set<string>>;

describe("i18n message files are consistent across locales", () => {
  it("every locale parses and has keys", () => {
    for (const l of LOCALES) expect(keysByLocale[l].size).toBeGreaterThan(0);
  });

  // Compare each non-reference locale against Swedish (the source language).
  const ref = "sv" as const;
  for (const l of LOCALES) {
    if (l === ref) continue;
    it(`${l}.json has the same keys as ${ref}.json`, () => {
      const refKeys = keysByLocale[ref];
      const locKeys = keysByLocale[l];
      const missingInLocale = [...refKeys].filter((k) => !locKeys.has(k));
      const extraInLocale = [...locKeys].filter((k) => !refKeys.has(k));
      expect(
        { missingInLocale, extraInLocale },
        `\n${l}.json drifted from ${ref}.json:\n` +
          (missingInLocale.length ? `  missing (${missingInLocale.length}): ${missingInLocale.slice(0, 30).join(", ")}\n` : "") +
          (extraInLocale.length ? `  extra (${extraInLocale.length}): ${extraInLocale.slice(0, 30).join(", ")}\n` : "")
      ).toEqual({ missingInLocale: [], extraInLocale: [] });
    });
  }
});
