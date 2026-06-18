import { describe, it, expect } from "vitest";
import {
  currentStep,
  previousStep,
  resolveTrack,
  fieldsForTrack,
  formStepForTrack,
  type OnboardingAnswers,
} from "../router";

describe("onboarding router · BankID-first gate (G1)", () => {
  it("starts at BankID and refuses to advance without it", () => {
    expect(currentStep({})).toBe("S0_BANKID");
    expect(currentStep({ role: "creator", company: "company" })).toBe("S0_BANKID");
  });
  it("moves to role selection once BankID is verified", () => {
    expect(currentStep({ bankIdVerified: true })).toBe("S1_ROLE");
  });
});

describe("onboarding router · creator branch (K1/K2)", () => {
  const base: OnboardingAnswers = { bankIdVerified: true, role: "creator" };
  it("asks K1 first", () => {
    expect(currentStep(base)).toBe("K1_COMPANY");
  });
  it("company + F-skatt → C1", () => {
    expect(currentStep({ ...base, company: "company" })).toBe("C1_FORM");
    expect(resolveTrack({ ...base, company: "company" })).toBe("C1");
  });
  it("nonprofit → C4", () => {
    expect(currentStep({ ...base, company: "nonprofit" })).toBe("C4_FORM");
    expect(resolveTrack({ ...base, company: "nonprofit" })).toBe("C4");
  });
  it("no company → K2, then salary → C2", () => {
    expect(currentStep({ ...base, company: "none" })).toBe("K2_PAYMENT");
    expect(currentStep({ ...base, company: "none", payment: "salary" })).toBe("C2_FORM");
    expect(resolveTrack({ ...base, company: "none", payment: "salary" })).toBe("C2");
  });
  it("no company → volunteer → C3", () => {
    expect(currentStep({ ...base, company: "none", payment: "volunteer" })).toBe("C3_FORM");
    expect(resolveTrack({ ...base, company: "none", payment: "volunteer" })).toBe("C3");
  });
});

describe("onboarding router · venue branch (V1–V3)", () => {
  const base: OnboardingAnswers = { bankIdVerified: true, role: "venue" };
  it("asks venue type first", () => {
    expect(currentStep(base)).toBe("V1_TYPE");
  });
  it("maps each venue type to its track", () => {
    expect(currentStep({ ...base, venueType: "company" })).toBe("V_FORM");
    expect(resolveTrack({ ...base, venueType: "company" })).toBe("V1");
    expect(resolveTrack({ ...base, venueType: "association" })).toBe("V2");
    expect(resolveTrack({ ...base, venueType: "public" })).toBe("V3");
  });
});

describe("onboarding router · back navigation", () => {
  it("mirrors the wireframe back targets", () => {
    expect(previousStep("S0_BANKID", {})).toBeNull();
    expect(previousStep("K1_COMPANY", {})).toBe("S1_ROLE");
    expect(previousStep("K2_PAYMENT", {})).toBe("K1_COMPANY");
    expect(previousStep("C2_FORM", {})).toBe("K2_PAYMENT");
    expect(previousStep("C1_FORM", {})).toBe("K1_COMPANY");
    expect(previousStep("V_FORM", {})).toBe("V1_TYPE");
    expect(previousStep("ESCROW_INFO", {})).toBe("DONE");
  });
});

describe("onboarding router · field sets (§4)", () => {
  it("includes the common fields for every track", () => {
    const keys = fieldsForTrack("C1").map((f) => f.key);
    expect(keys).toContain("legal_name");
    expect(keys).toContain("bank_account");
    expect(keys).toContain("tax_residence_country");
  });
  it("C1 collects org no, F-skatt and Stripe; C3 collects the volunteer attestation", () => {
    expect(fieldsForTrack("C1").map((f) => f.key)).toEqual(expect.arrayContaining(["org_no", "fskatt_status", "stripe_account_id"]));
    expect(fieldsForTrack("C3").map((f) => f.key)).toContain("volunteer_attestation");
  });
  it("V2 (association) does NOT collect a VAT number; V3 (public) collects a PO reference", () => {
    expect(fieldsForTrack("V2").map((f) => f.key)).not.toContain("vat_no");
    expect(fieldsForTrack("V3").map((f) => f.key)).toContain("po_reference");
  });
  it("all venue tracks share the same form step", () => {
    expect(formStepForTrack("V1")).toBe("V_FORM");
    expect(formStepForTrack("V2")).toBe("V_FORM");
    expect(formStepForTrack("V3")).toBe("V_FORM");
  });
});
