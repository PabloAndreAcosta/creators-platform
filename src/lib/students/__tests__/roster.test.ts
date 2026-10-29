import { describe, expect, it } from "vitest";
import { buildRoster, matchesStudent, studentKey, type RosterBooking } from "../roster";

const now = new Date("2026-10-29T12:00:00Z");
const b = (over: Partial<RosterBooking>): RosterBooking => ({
  id: Math.random().toString(36).slice(2),
  listing_id: "l1",
  customer_id: "c1",
  guest_email: null,
  guest_name: null,
  status: "confirmed",
  scheduled_at: "2026-10-22T16:00:00Z",
  created_at: "2026-10-01T10:00:00Z",
  amount_paid: 10000,
  sessions_total: null,
  sessions_redeemed: null,
  pass_expires_at: null,
  ...over,
});
const titles = new Map([["l1", "The Lab"], ["l2", "Klippkort 8"]]);
const names = new Map([["c1", "Sabina"]]);

describe("studentKey", () => {
  it("konto före gäst, gästens e-post i gemener", () => {
    expect(studentKey({ customer_id: "c1", guest_email: "x@y.se" })).toBe("customer:c1");
    expect(studentKey({ customer_id: null, guest_email: " Pernilla@Gmail.com " })).toBe("guest:pernilla@gmail.com");
    expect(studentKey({ customer_id: null, guest_email: null })).toBeNull();
  });
});

describe("buildRoster", () => {
  it("samlar en persons köp och räknar inte avbokade", () => {
    const r = buildRoster(
      [b({}), b({ scheduled_at: "2026-11-05T16:00:00Z" }), b({ status: "canceled", amount_paid: 99999 })],
      titles,
      names,
      now
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: "Sabina", bookings: 2, paidOre: 20000, lastAt: "2026-10-22T16:00:00Z", nextAt: "2026-11-05T16:00:00Z" });
  });

  it("gästköp blir egna elever och samma e-post slås ihop", () => {
    const r = buildRoster(
      [
        b({ customer_id: null, guest_email: "p@g.se", guest_name: "Pernilla" }),
        b({ customer_id: null, guest_email: "P@G.se" }),
      ],
      titles,
      names,
      now
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ guestEmail: "p@g.se", name: "Pernilla", bookings: 2 });
  });

  it("aktiva klippkort visar klipp kvar; förbrukade och utgångna visas inte", () => {
    const r = buildRoster(
      [
        b({ listing_id: "l2", sessions_total: 8, sessions_redeemed: 2 }),
        b({ listing_id: "l2", sessions_total: 5, sessions_redeemed: 5 }),
        b({ listing_id: "l2", sessions_total: 5, sessions_redeemed: 0, pass_expires_at: "2026-09-01T00:00:00Z" }),
      ],
      titles,
      names,
      now
    );
    expect(r[0].activePasses).toEqual([expect.objectContaining({ title: "Klippkort 8", left: 6 })]);
  });

  it("sorterar senast aktiva först", () => {
    const r = buildRoster(
      [b({ customer_id: "a", scheduled_at: "2026-10-01T16:00:00Z" }), b({ customer_id: "b", scheduled_at: "2026-10-22T16:00:00Z" })],
      titles,
      new Map(),
      now
    );
    expect(r.map((s) => s.customerId)).toEqual(["b", "a"]);
  });
});

describe("matchesStudent", () => {
  it("söker i namn, e-post och vad hen köpt", () => {
    const [s] = buildRoster([b({})], titles, names, now);
    expect(matchesStudent(s, "sab")).toBe(true);
    expect(matchesStudent(s, "lab")).toBe(true);
    expect(matchesStudent(s, "salsa")).toBe(false);
  });
});
