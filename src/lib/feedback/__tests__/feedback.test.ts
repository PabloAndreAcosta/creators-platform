import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasBottomNav, isFeedbackHiddenPath } from "../hidden-paths";
import { installFetchWatch, isIgnoredUrl, isTroubleStatus } from "../fetch-watch";
import { buildFeedback, sendFeedback, stripUrl, type FeedbackInput, type SentryLike } from "../send";
import {
  clearAttention,
  flagAttention,
  getFeedbackState,
  registerErrorScreen,
  resetFeedbackState,
  subscribeFeedback,
} from "../store";
import { detectStaticLocale, fillCode } from "../texts";

const EVENT_ID = "0123456789abcdef0123456789abcdef";

function input(over: Partial<FeedbackInput> = {}): FeedbackInput {
  return {
    message: "Köp-knappen gör ingenting",
    href: "https://usha.se/event/abc?code=HEMLIG#top",
    locale: "sv",
    shellTags: { skal: "webb" },
    source: "felknapp",
    shareUserId: false,
    ...over,
  };
}

function fakeSentry(over: Partial<SentryLike> = {}) {
  const capture = vi.fn<SentryLike["capture"]>(() => EVENT_ID);
  const flush = vi.fn<SentryLike["flush"]>(async () => true);
  const s: SentryLike = { hasClient: () => true, capture, flush, ...over };
  return { s, capture, flush };
}

describe("isFeedbackHiddenPath", () => {
  it.each([
    "/sjalvinslapp",
    "/sjalvinslapp/abc123",
    "/sjalvinslapp/abc123?kiosk=1",
    "/app/dorr",
    "/app/dorr/serie-1",
    "/app/events/42/entre",
    "/app/events/42/entre/",
    "/app/lyssna",
  ])("göms på %s", (p) => {
    expect(isFeedbackHiddenPath(p)).toBe(true);
  });

  it.each(["/", "/app", "/app/events/42", "/event/abc", "/dorrar", "/app/dorrvakt", "/login", "/dashboard"])(
    "visas på %s",
    (p) => {
      expect(isFeedbackHiddenPath(p)).toBe(false);
    },
  );

  it("lyfts över bottenmenyn bara i /app", () => {
    expect(hasBottomNav("/app/tickets")).toBe(true);
    expect(hasBottomNav("/app")).toBe(true);
    expect(hasBottomNav("/apparat")).toBe(false);
    expect(hasBottomNav("/marketplace")).toBe(false);
  });
});

describe("fetch-lyssnaren", () => {
  function fakeWindow(impl: (url: string) => Promise<Response>) {
    const w: Record<string, unknown> & { fetch: (i: RequestInfo | URL) => Promise<Response> } = {
      fetch: (i) => impl(String(i)),
    };
    return w;
  }
  const res = (status: number) => ({ status }) as Response;

  it("tänder vid 5xx men inte vid 2xx/4xx, och svaret går igenom orört", async () => {
    const onTrouble = vi.fn();
    const codes: Record<string, number> = { "/a": 200, "/b": 404, "/c": 503 };
    const w = fakeWindow(async (u) => res(codes[u]));
    installFetchWatch(w, onTrouble);
    expect((await w.fetch("/a")).status).toBe(200);
    expect((await w.fetch("/b")).status).toBe(404);
    expect(onTrouble).not.toHaveBeenCalled();
    expect((await w.fetch("/c")).status).toBe(503);
    expect(onTrouble).toHaveBeenCalledTimes(1);
  });

  it("tänder vid nätfel och kastar felet vidare", async () => {
    const onTrouble = vi.fn();
    const w = fakeWindow(async () => {
      throw new TypeError("Failed to fetch");
    });
    installFetchWatch(w, onTrouble);
    await expect(w.fetch("/x")).rejects.toThrow("Failed to fetch");
    expect(onTrouble).toHaveBeenCalledTimes(1);
  });

  it("räknar inte avbrutna anrop", async () => {
    const onTrouble = vi.fn();
    const w = fakeWindow(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    installFetchWatch(w, onTrouble);
    await expect(w.fetch("/x")).rejects.toThrow();
    expect(onTrouble).not.toHaveBeenCalled();
  });

  it("räknar inte Sentrys egna anrop", async () => {
    const onTrouble = vi.fn();
    const w = fakeWindow(async () => res(502));
    installFetchWatch(w, onTrouble);
    await w.fetch("/monitoring?o=1&p=2");
    await w.fetch("https://o1.ingest.de.sentry.io/api/1/envelope/");
    expect(onTrouble).not.toHaveBeenCalled();
    expect(isIgnoredUrl("/monitoringx")).toBe(false);
  });

  it("lindar bara en gång och kan tas bort", async () => {
    const onTrouble = vi.fn();
    const w = fakeWindow(async () => res(500));
    const original = w.fetch;
    const off = installFetchWatch(w, onTrouble);
    installFetchWatch(w, onTrouble);
    await w.fetch("/x");
    expect(onTrouble).toHaveBeenCalledTimes(1);
    off();
    expect(w.fetch).toBe(original);
  });

  it("5xx-gränserna", () => {
    expect(isTroubleStatus(499)).toBe(false);
    expect(isTroubleStatus(500)).toBe(true);
    expect(isTroubleStatus(599)).toBe(true);
    expect(isTroubleStatus(600)).toBe(false);
  });
});

describe("formulärets logik", () => {
  it("tar bort frågesträng och # ur adressen", () => {
    expect(stripUrl("https://usha.se/biljett/1?token=x#a")).toBe("https://usha.se/biljett/1");
    expect(buildFeedback(input()).params.url).toBe("https://usha.se/event/abc");
  });

  it("taggar språk, skal och källa", () => {
    const { params } = buildFeedback(input({ shellTags: { skal: "app", plattform: "android" }, locale: "es" }));
    expect(params.tags).toEqual({ skal: "app", plattform: "android", locale: "es", kalla: "felknapp" });
    expect(params.source).toBe("felknapp");
  });

  it("skickar användar-id bara när inloggad OCH rutan är ikryssad", () => {
    expect(buildFeedback(input({ userId: "u1", shareUserId: false })).user).toBeUndefined();
    expect(buildFeedback(input({ userId: undefined, shareUserId: true })).user).toBeUndefined();
    expect(buildFeedback(input({ userId: "u1", shareUserId: true })).user).toEqual({ id: "u1" });
  });

  it("kopplar bara giltiga Sentry-id och bär digest som tagg", () => {
    expect(buildFeedback(input({ associatedEventId: EVENT_ID })).params.associatedEventId).toBe(EVENT_ID);
    expect(buildFeedback(input({ associatedEventId: "1234567" })).params).not.toHaveProperty("associatedEventId");
    expect(buildFeedback(input({ digest: "1234567" })).params.tags.error_digest).toBe("1234567");
  });

  it("tom text skickas inte", async () => {
    const { s, capture } = fakeSentry();
    expect(await sendFeedback(input({ message: "   " }), s)).toBe("empty");
    expect(capture).not.toHaveBeenCalled();
  });

  it("utan Sentry-klient (ingen DSN) blir det 'unavailable', inget kast", async () => {
    const { s, capture } = fakeSentry({ hasClient: () => false });
    expect(await sendFeedback(input(), s)).toBe("unavailable");
    expect(capture).not.toHaveBeenCalled();
  });

  it("skickar och väntar in leveransen", async () => {
    const { s, capture, flush } = fakeSentry();
    expect(await sendFeedback(input({ userId: "u1", shareUserId: true }), s)).toBe("sent");
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ message: "Köp-knappen gör ingenting" }), { id: "u1" });
    expect(flush).toHaveBeenCalled();
  });

  it("misslyckad leverans eller kast ger 'failed'", async () => {
    expect(await sendFeedback(input(), fakeSentry({ flush: async () => false }).s)).toBe("failed");
    const throwing = fakeSentry({
      capture: () => {
        throw new Error("boom");
      },
    });
    expect(await sendFeedback(input(), throwing.s)).toBe("failed");
  });

  it("kapar för lång text", () => {
    expect(buildFeedback(input({ message: "a".repeat(5000) })).params.message).toHaveLength(2000);
  });
});

describe("knappens läge", () => {
  beforeEach(() => resetFeedbackState());

  it("tänds, släcks och meddelar lyssnare", () => {
    const l = vi.fn();
    subscribeFeedback(l);
    flagAttention();
    flagAttention();
    expect(getFeedbackState().attention).toBe(true);
    expect(l).toHaveBeenCalledTimes(1);
    clearAttention();
    expect(getFeedbackState().attention).toBe(false);
  });

  it("räknar felsidor, och avanmälan är idempotent", () => {
    const a = registerErrorScreen();
    const b = registerErrorScreen();
    expect(getFeedbackState().errorScreens).toBe(2);
    a();
    a();
    expect(getFeedbackState().errorScreens).toBe(1);
    b();
    expect(getFeedbackState().errorScreens).toBe(0);
  });
});

describe("global-errors språk", () => {
  it("cookie först, sedan enheten, annars svenska", () => {
    expect(detectStaticLocale("a=1; usha-locale=es", ["en-US"])).toBe("es");
    expect(detectStaticLocale("", ["de-DE", "en-GB"])).toBe("en");
    expect(detectStaticLocale("usha-locale=fr", ["de"])).toBe("sv");
  });

  it("fyller i felkoden", () => {
    expect(fillCode("Felkod: {code}", "abc")).toBe("Felkod: abc");
  });
});
