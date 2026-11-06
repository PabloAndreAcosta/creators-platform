import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { isSupabaseAuthCookie } from "@/lib/supabase/auth-cookies";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie-options";
import { CACHEABLE_PATHS, decidePublicCache } from "../public-pages";

/**
 * next.config.js sätter CDN-direktivet på funktionens svar och måste därför
 * spegla middlewarens regel. Om de glider isär kan en personlig rendering
 * cachas (direktiv utan omskrivning) eller en cachebar sida aldrig träffa.
 */
const require = createRequire(import.meta.url);

type Rule = { source: string; missing?: { type: string; key: string }[]; headers: { key: string; value: string }[] };

async function anonRules(): Promise<Rule[]> {
  const cfg = require("../../../../next.config.js");
  const rules: Rule[] = await cfg.headers();
  return rules.filter((r) => r.missing);
}

describe("next.config: CDN-direktiv för anonyma", () => {
  it("villkoren täcker allt som gör ett svar personligt", async () => {
    const rules = await anonRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      const cookies = r.missing!.filter((m) => m.type === "cookie").map((m) => m.key);
      const queries = r.missing!.filter((m) => m.type === "query").map((m) => m.key);
      // Auth-cookien, chunkar och PKCE-verifierare — samma mönster som isSupabaseAuthCookie.
      const auth = cookies.filter(isSupabaseAuthCookie);
      expect(auth).toContain(AUTH_COOKIE_NAME);
      expect(auth).toContain(`${AUTH_COOKIE_NAME}.0`);
      expect(auth).toContain(`${AUTH_COOKIE_NAME}-code-verifier`);
      expect(cookies).toContain("usha-theme");
      for (const q of ["ref", "lang", "utm_source", "utm_medium", "utm_campaign"]) expect(queries).toContain(q);
      expect(r.headers.map((h) => h.key)).toContain("Vercel-CDN-Cache-Control");
      // Vercels gräns — deploy #531 föll på 21 villkor.
      expect(r.missing!.length).toBeLessThanOrEqual(16);
    }
  });

  it("källorna matchar exakt CACHEABLE_PATHS", async () => {
    const rules = await anonRules();
    const covered = new Set<string>();
    for (const r of rules) {
      if (r.source === "/") covered.add("/");
      const m = r.source.match(/^\/\((.+)\)$/);
      if (m) for (const p of m[1].split("|")) covered.add(`/${p}`);
    }
    expect([...covered].sort()).toEqual([...CACHEABLE_PATHS].sort());
  });

  it("varje väg som konfigurationen ger direktiv för är cachebar i middleware", async () => {
    for (const p of CACHEABLE_PATHS) {
      expect(decidePublicCache({ method: "GET", pathname: p, searchParams: new URLSearchParams(), cookieNames: ["usha-locale"], locale: "sv" })).toMatchObject({ cacheable: true });
    }
  });
});
