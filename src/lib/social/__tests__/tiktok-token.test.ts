import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  needsRefresh,
  getValidTikTokAccessToken,
  REFRESH_MARGIN_SECONDS,
} from "../tiktok-token";

const NOW = new Date("2026-08-13T10:00:00Z");
const USER = "user-1";

function inSeconds(s: number): string {
  return new Date(NOW.getTime() + s * 1000).toISOString();
}

/** Minimal Supabase-stubbe som fångar vad som skrivs till raden. */
function supabaseStub() {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { client: client as never, updates };
}

describe("needsRefresh", () => {
  it("token med gott om tid kvar behöver inte förnyas", () => {
    expect(needsRefresh(inSeconds(3600), NOW)).toBe(false);
  });

  it("utgånget token behöver förnyas", () => {
    expect(needsRefresh(inSeconds(-1), NOW)).toBe(true);
  });

  it("token inom marginalen förnyas i förväg", () => {
    expect(needsRefresh(inSeconds(REFRESH_MARGIN_SECONDS - 30), NOW)).toBe(true);
    expect(needsRefresh(inSeconds(REFRESH_MARGIN_SECONDS + 30), NOW)).toBe(false);
  });

  it("okänd eller trasig utgång tvingar fram en förnyelse", () => {
    expect(needsRefresh(null, NOW)).toBe(true);
    expect(needsRefresh(undefined, NOW)).toBe(true);
    expect(needsRefresh("inte-ett-datum", NOW)).toBe(true);
  });
});

describe("getValidTikTokAccessToken", () => {
  beforeEach(() => {
    process.env.TIKTOK_CLIENT_KEY = "key";
    process.env.TIKTOK_CLIENT_SECRET = "secret";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;
  });

  it("returnerar befintligt token utan nätanrop när det fortfarande gäller", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { client, updates } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "live", refreshToken: "r", expiresAt: inSeconds(3600) },
      NOW
    );

    expect(out).toEqual({ ok: true, accessToken: "live" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("förnyar och sparar det roterade refresh-tokenet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "ny-access",
          refresh_token: "ny-refresh",
          expires_in: 86400,
          refresh_expires_in: 31536000,
        }),
        { status: 200 }
      )
    );
    const { client, updates } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "gammal-refresh", expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toEqual({ ok: true, accessToken: "ny-access" });
    expect(updates[0]).toMatchObject({
      tiktok_access_token: "ny-access",
      tiktok_refresh_token: "ny-refresh",
      tiktok_token_expires_at: "2026-08-14T10:00:00.000Z",
      tiktok_refresh_token_expires_at: "2027-08-13T10:00:00.000Z",
    });
  });

  it("behåller gamla refresh-tokenet när svaret utelämnar ett nytt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "ny", expires_in: 86400 }), { status: 200 })
    );
    const { client, updates } = supabaseStub();

    await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "behåll-mig", expiresAt: null },
      NOW
    );

    expect(updates[0].tiktok_refresh_token).toBe("behåll-mig");
  });

  it("4xx från TikTok betyder att användaren måste koppla om", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("invalid_grant", { status: 400 })
    );
    const { client } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "död", expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toEqual({ ok: false, needsReconnect: true, reason: "http_400" });
  });

  it("5xx är ett tillfälligt fel och ska inte be om omkoppling", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("oops", { status: 503 }));
    const { client } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "r", expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toMatchObject({ ok: false, needsReconnect: false });
  });

  it("nätverksfel ber inte heller om omkoppling", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const { client } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "r", expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toEqual({ ok: false, needsReconnect: false, reason: "network" });
  });

  it("saknad app-konfiguration är vårt fel, inte användarens", async () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    const { client } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "r", expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toEqual({ ok: false, needsReconnect: false, reason: "not_configured" });
  });

  it("koppling utan refresh-token kräver omkoppling", async () => {
    const { client } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: null, expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toEqual({ ok: false, needsReconnect: true, reason: "no_refresh_token" });
  });

  it("helt saknad koppling kräver omkoppling", async () => {
    const { client } = supabaseStub();

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: null, refreshToken: null, expiresAt: null },
      NOW
    );

    expect(out).toEqual({ ok: false, needsReconnect: true, reason: "not_connected" });
  });

  it("misslyckad sparning hindrar inte att anropet går igenom", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "ny", expires_in: 86400 }), { status: 200 })
    );
    const client = {
      from: () => ({
        update: () => ({ eq: async () => ({ error: { message: "RLS" } }) }),
      }),
    } as never;

    const out = await getValidTikTokAccessToken(
      client,
      USER,
      { accessToken: "gammal", refreshToken: "r", expiresAt: inSeconds(-10) },
      NOW
    );

    expect(out).toEqual({ ok: true, accessToken: "ny" });
  });
});
