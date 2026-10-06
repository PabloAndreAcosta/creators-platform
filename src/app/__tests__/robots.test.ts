import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

// Beslut 2026-10-06: AI-crawlers släpps in medvetet. Men de får SAMMA spärrar
// som alla andra — /biljett/ är någons kvitto med namn på. Att vi vill synas i
// AI-svar betyder inte att gästernas biljetter ska läsas.
describe("robots.txt", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];

  it("har en regel för alla och en för AI-crawlers", () => {
    expect(rules).toHaveLength(2);
  });

  it("släpper in de stora AI-crawlerna", () => {
    const ai = rules[1].userAgent as string[];
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"]) {
      expect(ai).toContain(bot);
    }
  });

  it("spärrar privata ytor för BÅDA grupperna", () => {
    for (const rule of rules) {
      const d = rule.disallow as string[];
      // Kvitton med personuppgifter, inloggade ytor och engångslänkar.
      for (const path of ["/biljett/", "/app/", "/dashboard/", "/api/", "/folj/", "/data-deletion/"]) {
        expect(d).toContain(path);
      }
    }
  });

  it("ger AI-crawlerna exakt samma spärrlista som alla andra", () => {
    expect(rules[1].disallow).toEqual(rules[0].disallow);
  });

  it("pekar ut sitemapen", () => {
    expect(r.sitemap).toBe("https://usha.se/sitemap.xml");
  });
});
