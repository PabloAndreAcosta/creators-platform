import { describe, it, expect } from "vitest";
import { escapeHtml, bodyToHtml, isValidCtaUrl, buildBroadcastHtml, chunk } from "../broadcast";

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
    const html = buildBroadcastHtml({ body: "Hej", unsubscribeUrl: "https://usha.se/waitlist/unsubscribe/abc" });
    expect(html).toContain("https://usha.se/waitlist/unsubscribe/abc");
    expect(html).toContain("Avregistrera");
  });
  it("includes the CTA only with a valid url + label", () => {
    const withCta = buildBroadcastHtml({ body: "x", ctaLabel: "Köp", ctaUrl: "https://usha.se/e", unsubscribeUrl: "u" });
    expect(withCta).toContain(">Köp<");
    expect(withCta).toContain("https://usha.se/e");

    const badUrl = buildBroadcastHtml({ body: "x", ctaLabel: "Köp", ctaUrl: "javascript:alert(1)", unsubscribeUrl: "u" });
    expect(badUrl).not.toContain("alert(1)");
    expect(badUrl).not.toContain(">Köp<");

    const noLabel = buildBroadcastHtml({ body: "x", ctaUrl: "https://usha.se/e", unsubscribeUrl: "u" });
    expect(noLabel).not.toContain("https://usha.se/e");
  });
  it("escapes injected body content", () => {
    const html = buildBroadcastHtml({ body: "<img src=x onerror=alert(1)>", unsubscribeUrl: "u" });
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
