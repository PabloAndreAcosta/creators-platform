import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createTranslator } from "next-intl";
import { escapeHtml, bodyToHtml, isValidCtaUrl, buildBroadcastHtml, chunk } from "../broadcast";
import type { Translate } from "@/lib/i18n/server";

/** The `emails` translator a real send would hand in. */
function translatorFor(locale: "sv" | "en" | "es"): Translate {
  const messages = JSON.parse(
    readFileSync(join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")
  );
  const t = createTranslator({ locale, messages, namespace: "emails", onError: () => {} });
  const fn = ((key: string, params?: Record<string, string | number>) =>
    t(key as never, params as never) as unknown as string) as Translate;
  fn.has = (key: string) => messages.emails?.[key] != null;
  return fn;
}

const sv = translatorFor("sv");

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml('<script>"&\'')).toBe("&lt;script&gt;&quot;&amp;&#39;");
  });
});

describe("bodyToHtml", () => {
  it("escapes and turns newlines into <br>", () => {
    expect(bodyToHtml("Hej\nVärlden")).toBe("Hej<br>Världen");
    expect(bodyToHtml("a\r\nb")).toBe("a<br>b");
  });
  it("neutralises injected markup", () => {
    expect(bodyToHtml("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("isValidCtaUrl", () => {
  it("accepts http(s)", () => {
    expect(isValidCtaUrl("https://usha.se/event/x")).toBe(true);
    expect(isValidCtaUrl("http://example.com")).toBe(true);
  });
  it("rejects non-http and garbage", () => {
    expect(isValidCtaUrl("javascript:alert(1)")).toBe(false);
    expect(isValidCtaUrl("mailto:a@b.se")).toBe(false);
    expect(isValidCtaUrl("/relative")).toBe(false);
    expect(isValidCtaUrl("not a url")).toBe(false);
  });
});

describe("buildBroadcastHtml", () => {
  it("always includes the unsubscribe link", () => {
    const html = buildBroadcastHtml({ body: "Hej", unsubscribeUrl: "https://usha.se/waitlist/unsubscribe/abc", t: sv });
    expect(html).toContain("https://usha.se/waitlist/unsubscribe/abc");
    expect(html).toContain("Avregistrera");
  });
  it("includes the CTA only with a valid url + label", () => {
    const withCta = buildBroadcastHtml({ body: "x", ctaLabel: "Köp", ctaUrl: "https://usha.se/e", unsubscribeUrl: "u", t: sv });
    expect(withCta).toContain(">Köp<");
    expect(withCta).toContain("https://usha.se/e");

    const badUrl = buildBroadcastHtml({ body: "x", ctaLabel: "Köp", ctaUrl: "javascript:alert(1)", unsubscribeUrl: "u", t: sv });
    expect(badUrl).not.toContain("alert(1)");
    expect(badUrl).not.toContain(">Köp<");

    const noLabel = buildBroadcastHtml({ body: "x", ctaUrl: "https://usha.se/e", unsubscribeUrl: "u", t: sv });
    expect(noLabel).not.toContain("https://usha.se/e");
  });
  it("writes the footer in the reader's language but leaves the host's words alone", () => {
    const opts = { body: "Vi ses på fredag!", unsubscribeUrl: "u" };
    expect(buildBroadcastHtml({ ...opts, t: sv })).toContain("Avregistrera dig");
    expect(buildBroadcastHtml({ ...opts, t: translatorFor("en") })).toContain("Unsubscribe");
    expect(buildBroadcastHtml({ ...opts, t: translatorFor("es") })).toContain("Darse de baja");
    // The body is the host's own writing — it is never translated.
    for (const loc of ["sv", "en", "es"] as const) {
      expect(buildBroadcastHtml({ ...opts, t: translatorFor(loc) })).toContain("Vi ses på fredag!");
    }
  });

  it("escapes injected body content", () => {
    const html = buildBroadcastHtml({ body: "<img src=x onerror=alert(1)>", unsubscribeUrl: "u", t: sv });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("chunk", () => {
  it("splits into groups of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});
