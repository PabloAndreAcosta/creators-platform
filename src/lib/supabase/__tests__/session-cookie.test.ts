import { describe, it, expect } from "vitest";
import { stringToBase64URL } from "@supabase/ssr";
import { guardSessionCookies, isSessionCookieName, isSessionCookieReadable } from "../session-cookie";

const KEY = "sb-x-auth-token";
const session = JSON.stringify({
  access_token: "a.b.c",
  refresh_token: "r",
  expires_at: 1,
  user: { id: "u1", email: "gast@example.com" },
});
const encoded = `base64-${stringToBase64URL(session)}`;

function jar(cookies: Record<string, string>) {
  return (name: string) => cookies[name];
}

describe("session-cookie", () => {
  it("känner igen sessionen och dess chunkar, inte PKCE-verifieraren", () => {
    expect(isSessionCookieName(KEY, KEY)).toBe(true);
    expect(isSessionCookieName(`${KEY}.0`, KEY)).toBe(true);
    expect(isSessionCookieName(`${KEY}.12`, KEY)).toBe(true);
    expect(isSessionCookieName(`${KEY}-code-verifier`, KEY)).toBe(false);
    expect(isSessionCookieName(`${KEY}.x`, KEY)).toBe(false);
  });

  it("godkänner en hel base64-session och en utan cookie alls", () => {
    expect(isSessionCookieReadable(jar({ [KEY]: encoded }), KEY)).toBe(true);
    expect(isSessionCookieReadable(jar({}), KEY)).toBe(true);
  });

  it("godkänner chunkar som hör ihop", () => {
    const mid = Math.floor(encoded.length / 2);
    const cookies = { [`${KEY}.0`]: encoded.slice(0, mid), [`${KEY}.1`]: encoded.slice(mid) };
    expect(isSessionCookieReadable(jar(cookies), KEY)).toBe(true);
  });

  // Fallet från /app/tickets 2026-11-20: en refresh skrev nya chunkar men en
  // gammal hängde kvar, så JSON:en blev trasig. auth-js fick då tillbaka
  // råsträngen och kraschade på `session.user = …`.
  it("underkänner chunkar från olika sessioner", () => {
    const other = `base64-${stringToBase64URL(JSON.stringify({ access_token: "x.y.z", refresh_token: "q", user: { id: "u2" } }))}`;
    const cookies = {
      [`${KEY}.0`]: encoded.slice(0, 40),
      [`${KEY}.1`]: other.slice(55),
    };
    expect(isSessionCookieReadable(jar(cookies), KEY)).toBe(false);
  });

  it("underkänner en avkapad session (sista chunken saknas)", () => {
    expect(isSessionCookieReadable(jar({ [`${KEY}.0`]: encoded.slice(0, 60) }), KEY)).toBe(false);
  });

  it("underkänner en session som är en JSON-sträng i stället för ett objekt", () => {
    const doubled = `base64-${stringToBase64URL(JSON.stringify(session))}`;
    expect(isSessionCookieReadable(jar({ [KEY]: doubled }), KEY)).toBe(false);
  });

  it("läser trasig session som saknad men släpper igenom andra cookies", () => {
    const read = guardSessionCookies(
      jar({
        [`${KEY}.0`]: encoded.slice(0, 60),
        [`${KEY}-code-verifier`]: "verifier",
        NEXT_LOCALE: "sv",
      }),
      KEY
    );
    expect(read(`${KEY}.0`)).toBeUndefined();
    expect(read(KEY)).toBeUndefined();
    expect(read(`${KEY}-code-verifier`)).toBe("verifier");
    expect(read("NEXT_LOCALE")).toBe("sv");
  });

  it("lämnar en hel session orörd", () => {
    const read = guardSessionCookies(jar({ [KEY]: encoded }), KEY);
    expect(read(KEY)).toBe(encoded);
  });
});
