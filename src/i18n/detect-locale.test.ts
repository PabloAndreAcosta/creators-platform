import { describe, it, expect } from "vitest";
import { detectLocaleFromAcceptLanguage, isLikelyBot } from "./config";

describe("detectLocaleFromAcceptLanguage", () => {
  it("falls back to English when there is no header", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
    expect(detectLocaleFromAcceptLanguage("")).toBe("en");
    expect(detectLocaleFromAcceptLanguage(undefined)).toBe("en");
  });

  it("matches a supported language on the primary subtag", () => {
    expect(detectLocaleFromAcceptLanguage("sv-SE,sv;q=0.9")).toBe("sv");
    expect(detectLocaleFromAcceptLanguage("es-ES")).toBe("es");
    expect(detectLocaleFromAcceptLanguage("en-GB,en;q=0.8")).toBe("en");
  });

  it("falls back to English for unsupported languages", () => {
    expect(detectLocaleFromAcceptLanguage("de-DE,de;q=0.9,fr;q=0.8")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("nb-NO")).toBe("en");
  });

  it("honours q-value ranking, not header order", () => {
    // German first but low q; Spanish higher q → Spanish wins.
    expect(detectLocaleFromAcceptLanguage("de;q=0.5,es;q=0.9")).toBe("es");
  });

  it("picks the first supported language when scanning down the list", () => {
    // Unsupported (fr) highest, then Swedish → Swedish.
    expect(detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9,sv;q=0.7")).toBe("sv");
  });

  it("honours a custom fallback for unmatched/empty input", () => {
    expect(detectLocaleFromAcceptLanguage(null, "sv")).toBe("sv");
    expect(detectLocaleFromAcceptLanguage("de-DE", "sv")).toBe("sv");
    // A supported match still wins over the fallback.
    expect(detectLocaleFromAcceptLanguage("en-US", "sv")).toBe("en");
  });
});

describe("isLikelyBot", () => {
  it("flags common crawlers / preview bots", () => {
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot("Twitterbot/1.0")).toBe(true);
  });
  it("does not flag real browsers", () => {
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(false);
    expect(isLikelyBot(null)).toBe(false);
    expect(isLikelyBot("")).toBe(false);
  });
});
