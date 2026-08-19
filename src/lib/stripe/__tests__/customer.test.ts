import { describe, it, expect } from "vitest";
import { isRealStripeCustomer } from "../customer";

describe("skiljer en riktig Stripe-kund från en komp-platshållare", () => {
  it("godtar ett Stripe-kund-id", () => {
    expect(isRealStripeCustomer("cus_QxYz1234abcd")).toBe(true);
  });

  it("avvisar komp-platshållarna", () => {
    // These are what a hand-granted lifetime plan stores, and passing one to
    // Stripe's billing portal is a 500 the user reads as "the app is broken".
    expect(isRealStripeCustomer("comp_owner")).toBe(false);
    expect(isRealStripeCustomer("comp_owner_lifetime_gmail")).toBe(false);
  });

  it("avvisar tomt och saknat", () => {
    expect(isRealStripeCustomer("")).toBe(false);
    expect(isRealStripeCustomer(null)).toBe(false);
    expect(isRealStripeCustomer(undefined)).toBe(false);
  });

  it("avvisar något som bara börjar likadant", () => {
    expect(isRealStripeCustomer("customer_123")).toBe(false);
    expect(isRealStripeCustomer("cus_")).toBe(false);
    expect(isRealStripeCustomer(" cus_abc")).toBe(false);
  });
});
