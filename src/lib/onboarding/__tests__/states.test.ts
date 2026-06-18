import { describe, it, expect } from "vitest";
import {
  canTransitionBooking,
  canTransitionPayout,
  transitionBooking,
  transitionPayout,
  StateTransitionError,
} from "../states";

describe("booking state machine (§6)", () => {
  it("walks the happy escrow path requested → … → settled", () => {
    let s = transitionBooking("requested", "accepted");
    s = transitionBooking(s, "in_escrow");
    s = transitionBooking(s, "completed");
    s = transitionBooking(s, "settled");
    expect(s).toBe("settled");
  });
  it("rejects skipping escrow", () => {
    expect(canTransitionBooking("requested", "completed")).toBe(false);
    expect(() => transitionBooking("requested", "settled")).toThrow(StateTransitionError);
  });
  it("allows dispute and refund from escrow", () => {
    expect(canTransitionBooking("in_escrow", "disputed")).toBe(true);
    expect(canTransitionBooking("in_escrow", "refunded")).toBe(true);
  });
  it("terminal states cannot transition", () => {
    expect(canTransitionBooking("settled", "completed")).toBe(false);
    expect(canTransitionBooking("cancelled", "accepted")).toBe(false);
  });
});

describe("payout state machine (§6)", () => {
  it("walks pending → held → released → paid", () => {
    let s = transitionPayout("pending", "held");
    s = transitionPayout(s, "released");
    s = transitionPayout(s, "paid");
    expect(s).toBe("paid");
  });
  it("can be blocked from pending or held (e.g. G2/G3) and retried", () => {
    expect(canTransitionPayout("pending", "blocked")).toBe(true);
    expect(canTransitionPayout("held", "blocked")).toBe(true);
    expect(canTransitionPayout("blocked", "pending")).toBe(true);
  });
  it("cannot pay directly from pending (must be held then released)", () => {
    expect(canTransitionPayout("pending", "paid")).toBe(false);
    expect(() => transitionPayout("pending", "paid")).toThrow();
  });
});
