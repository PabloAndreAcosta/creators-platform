import { describe, it, expect } from "vitest";
import {
  checkBankIdGate,
  checkFskattForPayout,
  isFskattCheckStale,
  isVolunteerEligible,
  checkVolunteerPayout,
  buildReleaseLedger,
  checkMoneyPath,
  switchTrack,
  vatOnCommissionOnly,
  dac7RecordForSettled,
  mergeDac7,
  quarterOf,
  type LedgerEntry,
} from "../guards";
import { FSKATT_MAX_AGE_DAYS, USHA_ACCOUNT_ID } from "../config";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("G1 · BankID gate", () => {
  it("blocks profile creation without verified BankID", () => {
    expect(checkBankIdGate({ bankid_verified: false }).allowed).toBe(false);
    expect(checkBankIdGate({ bankid_verified: false }).code).toBe("G1_BANKID_REQUIRED");
  });
  it("allows once BankID is verified", () => {
    expect(checkBankIdGate({ bankid_verified: true }).allowed).toBe(true);
  });
});

describe("G2 · F-skatt gate", () => {
  it("only governs the C1 track", () => {
    expect(checkFskattForPayout({ track: "C2", fskatt_status: "inactive", fskatt_checked_at: null }).allowed).toBe(true);
  });
  it("blocks C1 payout when F-skatt is not active", () => {
    const r = checkFskattForPayout({ track: "C1", fskatt_status: "inactive", fskatt_checked_at: daysAgo(1) });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("G2_FSKATT_INACTIVE");
  });
  it("blocks C1 payout when the F-skatt check is stale", () => {
    const r = checkFskattForPayout({ track: "C1", fskatt_status: "active", fskatt_checked_at: daysAgo(FSKATT_MAX_AGE_DAYS + 1) });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("G2_FSKATT_STALE");
  });
  it("allows a fresh, active C1 check", () => {
    expect(checkFskattForPayout({ track: "C1", fskatt_status: "active", fskatt_checked_at: daysAgo(1) }).allowed).toBe(true);
  });
  it("treats a missing check as stale", () => {
    expect(isFskattCheckStale(null)).toBe(true);
  });
});

describe("G3 · Volunteer lock", () => {
  it("eligibility is decided by absence of compensation/benefit, not by role", () => {
    expect(isVolunteerEligible(false)).toBe(true); // no compensation → eligible
    expect(isVolunteerEligible(true)).toBe(false); // any gage/gift/free entry → not eligible
  });
  it("blocks a real payout on the volunteer track", () => {
    const r = checkVolunteerPayout("C3", { kind: "payout", gross: 500 });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("G3_VOLUNTEER_PAYOUT_BLOCKED");
  });
  it("allows an expense reimbursement on the volunteer track", () => {
    expect(checkVolunteerPayout("C3", { kind: "expense_reimbursement", gross: 500 }).allowed).toBe(true);
  });
  it("does not constrain non-volunteer tracks", () => {
    expect(checkVolunteerPayout("C1", { kind: "payout", gross: 500 }).allowed).toBe(true);
    expect(checkVolunteerPayout("C2", { kind: "payout", gross: 500 }).allowed).toBe(true);
  });
});

describe("G4 · Money path (gross never to Usha)", () => {
  const booking = { amount_gross: 1000, commission: 150 };

  it("a correct release credits only commission to Usha", () => {
    const ledger = buildReleaseLedger(booking, "acct_creator");
    const usha = ledger.filter((e) => e.account === USHA_ACCOUNT_ID);
    expect(usha).toHaveLength(1);
    expect(usha[0].kind).toBe("commission");
    expect(usha[0].credit).toBe(150);
    expect(checkMoneyPath(ledger, booking.commission).allowed).toBe(true);
  });
  it("rejects any gross credited to Usha", () => {
    const bad: LedgerEntry[] = [
      { account: USHA_ACCOUNT_ID, credit: 1000, kind: "gross" },
      { account: "acct_creator", credit: 0, kind: "net" },
    ];
    const r = checkMoneyPath(bad, 150);
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("G4_GROSS_TO_USHA");
  });
  it("rejects a commission mismatch", () => {
    const ledger = buildReleaseLedger(booking, "acct_creator");
    expect(checkMoneyPath(ledger, 999).allowed).toBe(false);
  });
  it("net + commission reconstructs gross (nothing leaks)", () => {
    const ledger = buildReleaseLedger(booking, "acct_creator");
    const total = ledger.reduce((s, e) => s + e.credit, 0);
    expect(total).toBe(booking.amount_gross);
  });
});

describe("G5 · Track switch", () => {
  it("records the change and adopts the new track", () => {
    const { track, change } = switchTrack("C2", "C1", "2026-06-18T00:00:00Z");
    expect(track).toBe("C1");
    expect(change).toEqual({ from: "C2", to: "C1", at: "2026-06-18T00:00:00Z" });
  });
  it("is a no-op when the track is unchanged", () => {
    expect(switchTrack("C1", "C1", "2026-06-18T00:00:00Z").change).toBeNull();
  });
});

describe("G6 · VAT flag", () => {
  it("flags only a non-VAT-registered association (V2)", () => {
    expect(vatOnCommissionOnly("V2", false)).toBe(true);
    expect(vatOnCommissionOnly("V2", true)).toBe(false);
    expect(vatOnCommissionOnly("V1", false)).toBe(false);
    expect(vatOnCommissionOnly("V3", false)).toBe(false);
  });
});

describe("G7 · DAC7 log", () => {
  it("derives the right quarter", () => {
    expect(quarterOf(new Date("2026-02-10"))).toBe(1);
    expect(quarterOf(new Date("2026-06-18"))).toBe(2);
    expect(quarterOf(new Date("2026-11-01"))).toBe(4);
  });
  it("builds a record from a settled booking using the completion date", () => {
    const rec = dac7RecordForSettled(
      { amount_gross: 1000, completed_at: "2026-06-18T10:00:00Z", created_at: "2026-01-01T00:00:00Z" },
      "seller-1",
    );
    expect(rec).toMatchObject({ seller_id: "seller-1", quarter: 2, year: 2026, consideration: 1000, currency: "SEK" });
  });
  it("merges considerations within the same quarter", () => {
    const a = dac7RecordForSettled({ amount_gross: 1000, completed_at: "2026-06-18T10:00:00Z", created_at: "" }, "s1");
    const b = dac7RecordForSettled({ amount_gross: 500, completed_at: "2026-06-20T10:00:00Z", created_at: "" }, "s1");
    expect(mergeDac7(a, b).consideration).toBe(1500);
  });
});
