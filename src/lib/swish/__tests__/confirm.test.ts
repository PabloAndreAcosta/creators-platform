import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Ett Swish-köp avgörs på ett ställe (lib/swish/confirm.ts). Dörrens knappar
 * och bekräftelsesidan från notisen går båda genom entry/swish/confirm-rutten,
 * så här provas rutten med riktig logik mot en liten fake-databas — och sidans
 * laddare, som måste neka obehöriga innan något om köpet lämnar servern.
 */

type Row = Record<string, unknown>;
const db: { listings: Row[]; bookings: Row[]; profiles: Row[]; rpc: { fn: string; args: Row }[] } = {
  listings: [],
  bookings: [],
  profiles: [],
  rpc: [],
};

function query(table: string) {
  const filters: [string, unknown][] = [];
  let op: "select" | "update" = "select";
  let payload: Row = {};
  const rows = () => (db as unknown as Record<string, Row[]>)[table] ?? [];
  const match = () => rows().filter((r) => filters.every(([c, v]) => r[c] === v));
  const run = () => {
    if (op === "update") {
      const hit = match();
      hit.forEach((r) => Object.assign(r, payload));
      return { data: hit, error: null };
    }
    return { data: match(), error: null };
  };
  const b = {
    select: () => b,
    update: (p: Row) => ((op = "update"), (payload = p), b),
    eq: (c: string, v: unknown) => (filters.push([c, v]), b),
    maybeSingle: async () => {
      const r = run();
      return { data: r.data[0] ?? null, error: null };
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
  };
  return b;
}

const admin = {
  from: query,
  rpc: (fn: string, args: Row) => {
    db.rpc.push({ fn, args });
    return Promise.resolve({ error: null });
  },
};

let currentUser: { id: string } | null = null;
const allowed = new Set<string>();

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/supabase/current-user", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ allowed: true }), getRateLimitKey: () => "k" }));
vi.mock("@/lib/scan-access", () => ({
  canOperateEntrance: vi.fn(async (_a: unknown, userId: string) => allowed.has(userId)),
}));
vi.mock("@/lib/notifications/create", () => ({ createNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/email/send-booking", () => ({ sendBookingConfirmationEmail: vi.fn(async () => {}) }));

import { POST } from "@/app/api/events/[id]/entry/swish/confirm/route";
import { loadSwishForConfirm, type SwishListing } from "../confirm";
import { createNotification } from "@/lib/notifications/create";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import type { SupabaseClient } from "@supabase/supabase-js";

const LISTING = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const BOOKING = "22222222-2222-4222-8222-222222222222";

function call(body: Row, listingId = LISTING) {
  const req = new NextRequest(`https://usha.se/api/events/${listingId}/entry/swish/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingId: BOOKING, ...body }),
  });
  return POST(req, { params: Promise.resolve({ id: listingId }) });
}

const booking = () => db.bookings.find((b) => b.id === BOOKING)!;

beforeEach(() => {
  currentUser = { id: "dorr" };
  allowed.clear();
  allowed.add("dorr");
  db.listings = [
    {
      id: LISTING,
      user_id: "owner",
      title: "The Lab",
      event_date: "2026-11-26",
      event_time: "17:00:00",
      event_end_time: "23:00:00",
      event_location: "Bacchi",
      organizer_name: null,
    },
    { id: OTHER, user_id: "owner", title: "Annan", event_date: "2026-12-03", event_time: null, event_end_time: null, event_location: null, organizer_name: null },
  ];
  db.bookings = [
    {
      id: BOOKING,
      listing_id: LISTING,
      payment_method: "swish",
      status: "pending",
      customer_id: "kund",
      guest_name: "Ana",
      guest_email: "ana@example.com",
      amount_paid: 13000,
      guest_count: 1,
      ticket_type_id: null,
      ticket_type_name: null,
      scheduled_at: "2026-11-26T16:00:00.000Z",
      notes: null,
    },
  ];
  db.profiles = [{ id: "owner", company_name: "Usha AB", org_number: "559000-0000", full_name: "Pablo" }];
  db.rpc = [];
  vi.mocked(createNotification).mockClear();
  vi.mocked(sendBookingConfirmationEmail).mockClear();
});

describe("entry/swish/confirm — grinden", () => {
  it("utan inloggning: 401 och ingenting ändras", async () => {
    currentUser = null;
    const res = await call({ action: "confirm" });
    expect(res.status).toBe(401);
    expect(booking().status).toBe("pending");
  });

  it("inloggad utan dörrbehörighet: 403 och ingenting ändras", async () => {
    currentUser = { id: "nagon" };
    const res = await call({ action: "confirm" });
    expect(res.status).toBe(403);
    expect(booking().status).toBe("pending");
    expect(db.rpc).toHaveLength(0);
  });

  it("bokningen hör till ett annat evenemang: 409", async () => {
    const res = await call({ action: "confirm" }, OTHER);
    expect(res.status).toBe(409);
    expect(booking().status).toBe("pending");
  });
});

describe("entry/swish/confirm — Bekräfta och Avvisa", () => {
  it("Bekräfta: bekräftad, biljetten räknas, QR mejlas, gästen får notis — men checkas inte in", async () => {
    const res = await call({ action: "confirm", checkIn: false, via: "notice" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "confirmed", checkedIn: false, emailed: true });
    expect(booking().status).toBe("confirmed");
    expect(booking().checked_in_at).toBeUndefined();
    expect(String(booking().notes)).toContain("från notisen");
    expect(db.rpc).toEqual([{ fn: "increment_tickets_sold", args: { p_listing: LISTING, p_n: 1, p_ticket_type: undefined } }]);
    expect(sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "kund", titleKey: "swishConfirmedTitle" }));
  });

  it("Bekräfta med Gästen står här: incheckad av den som bekräftade", async () => {
    await call({ action: "confirm", checkIn: true });
    expect(booking().checked_in_at).toBeTruthy();
    expect(booking().scanned_by).toBe("dorr");
    expect(String(booking().notes)).toContain("i entrén");
  });

  it("samma köp två gånger räknas bara en gång", async () => {
    await call({ action: "confirm" });
    const again = await call({ action: "confirm" });
    expect(again.status).toBe(409);
    expect(db.rpc).toHaveLength(1);
  });

  it("Avvisa: avbokad, inget räknas, inget biljettmejl, gästen får veta", async () => {
    const res = await call({ action: "reject" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "canceled" });
    expect(booking().status).toBe("canceled");
    expect(db.rpc).toHaveLength(0);
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "kund", titleKey: "swishRejectedTitle" }));
  });
});

describe("loadSwishForConfirm — bekräftelsesidan", () => {
  const can = (userId: string) => async (l: SwishListing) => {
    void l;
    return allowed.has(userId);
  };
  const a = admin as unknown as SupabaseClient;

  it("nekar den som inte får sköta entrén, utan att lämna ut köpet", async () => {
    const r = await loadSwishForConfirm(a, BOOKING, can("nagon"));
    expect(r).toEqual({ kind: "forbidden" });
  });

  it("okänt köp, eller ett som inte är Swish: finns inte", async () => {
    expect(await loadSwishForConfirm(a, OTHER, can("dorr"))).toEqual({ kind: "notFound" });
    booking().payment_method = "card";
    expect(await loadSwishForConfirm(a, BOOKING, can("dorr"))).toEqual({ kind: "notFound" });
  });

  it("kvällen innan: Gästen står här är AV", async () => {
    const r = await loadSwishForConfirm(a, BOOKING, can("dorr"), new Date("2026-11-25T20:00:00Z"));
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.view.checkInDefault).toBe(false);
      expect(r.view.booking).toMatchObject({ guest_name: "Ana", amount_paid: 13000, status: "pending" });
    }
  });

  it("under pågående kväll: Gästen står här är PÅ", async () => {
    const r = await loadSwishForConfirm(a, BOOKING, can("dorr"), new Date("2026-11-26T18:00:00Z"));
    expect(r.kind === "ok" && r.view.checkInDefault).toBe(true);
  });

  it("redan avgjort köp visas med sin status", async () => {
    booking().status = "confirmed";
    const r = await loadSwishForConfirm(a, BOOKING, can("dorr"));
    expect(r.kind === "ok" && r.view.booking.status).toBe("confirmed");
  });
});
