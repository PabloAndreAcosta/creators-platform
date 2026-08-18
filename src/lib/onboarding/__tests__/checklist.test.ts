import { describe, it, expect } from "vitest";
import { buildOnboardingSteps, onboardingProgress, type OnboardingContext } from "../checklist";

const base: OnboardingContext = {
  role: "creator",
  isCompany: false,
  bio: null,
  avatarUrl: null,
  bankidVerifiedAt: null,
  companyVerifiedAt: null,
  termsUrl: null,
  servicesCount: 0,
  stripeAccountId: null,
  stripeCardPaymentsEnabled: false,
  isPublic: false,
};

const keys = (ctx: OnboardingContext) => buildOnboardingSteps(ctx).map((s) => s.key);

describe("buildOnboardingSteps — categories", () => {
  it("creator (privatperson): profile, bankid, listing, stripe, public — no company/terms", () => {
    expect(keys({ ...base })).toEqual(["profile", "bankid", "listing", "stripe", "public"]);
  });

  it("creator med bolag: adds company + terms", () => {
    expect(keys({ ...base, isCompany: true })).toEqual([
      "profile",
      "bankid",
      "company",
      "terms",
      "listing",
      "stripe",
      "public",
    ]);
  });

  it("venue: company required, bankid optional (only until company verified), terms", () => {
    expect(keys({ ...base, role: "venue" })).toEqual([
      "profile",
      "bankid",
      "company",
      "terms",
      "listing",
      "stripe",
      "public",
    ]);
    // once company is verified, the optional bankid step drops off
    expect(keys({ ...base, role: "venue", companyVerifiedAt: "2026-08-18" })).toEqual([
      "profile",
      "company",
      "terms",
      "listing",
      "stripe",
      "public",
    ]);
  });

  it("customer: light flow only", () => {
    expect(keys({ ...base, role: "customer" })).toEqual(["customer_profile", "customer_preferences"]);
  });
});

describe("buildOnboardingSteps — required flags", () => {
  it("creator bankid is required; venue bankid is optional", () => {
    const creatorBankid = buildOnboardingSteps({ ...base }).find((s) => s.key === "bankid");
    const venueBankid = buildOnboardingSteps({ ...base, role: "venue" }).find((s) => s.key === "bankid");
    expect(creatorBankid?.required).toBe(true);
    expect(venueBankid?.required).toBe(false);
  });

  it("terms is optional/recommended", () => {
    const terms = buildOnboardingSteps({ ...base, isCompany: true }).find((s) => s.key === "terms");
    expect(terms?.required).toBe(false);
  });
});

describe("buildOnboardingSteps — Stripe MoR sub-cases", () => {
  it("no account → connectStripe, not done", () => {
    const s = buildOnboardingSteps({ ...base }).find((x) => x.key === "stripe")!;
    expect(s.labelKey).toBe("connectStripe");
    expect(s.done).toBe(false);
  });
  it("connected but no card_payments → completeStripe, not done", () => {
    const s = buildOnboardingSteps({ ...base, stripeAccountId: "acct_1", stripeCardPaymentsEnabled: false }).find((x) => x.key === "stripe")!;
    expect(s.labelKey).toBe("completeStripe");
    expect(s.done).toBe(false);
  });
  it("connected + card_payments → done", () => {
    const s = buildOnboardingSteps({ ...base, stripeAccountId: "acct_1", stripeCardPaymentsEnabled: true }).find((x) => x.key === "stripe")!;
    expect(s.done).toBe(true);
  });
});

describe("onboardingProgress", () => {
  it("counts done vs total", () => {
    const steps = buildOnboardingSteps({
      ...base,
      bio: "hi",
      avatarUrl: "a.png",
      bankidVerifiedAt: "2026-08-18",
    });
    const p = onboardingProgress(steps);
    expect(p.total).toBe(5);
    expect(p.done).toBe(2); // profile + bankid
  });
});
