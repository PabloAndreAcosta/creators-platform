import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolvePayeeFlow,
  buildConnectPaymentIntentData,
  buildStatementDescriptorSuffix,
  receiptSeller,
  type PayeeContext,
} from "../checkout";

const OWNER_ID = "15d852ed-1f33-446f-9bcb-821c2444c84f"; // beta-gate default owner

function payee(overrides: Partial<PayeeContext> = {}): PayeeContext {
  return {
    id: "third-party-1",
    stripe_account_id: "acct_123",
    card_payments_enabled: false,
    is_usha_owned_seller: false,
    company_name: null,
    org_number: null,
    full_name: "Anna Andersson",
    ...overrides,
  };
}

describe("resolvePayeeFlow", () => {
  it("owner id → usha_principal", () => {
    expect(resolvePayeeFlow(payee({ id: OWNER_ID }))).toBe("usha_principal");
  });
  it("is_usha_owned_seller → usha_principal", () => {
    expect(resolvePayeeFlow(payee({ is_usha_owned_seller: true }))).toBe("usha_principal");
  });
  it("ordinary organizer → third_party", () => {
    expect(resolvePayeeFlow(payee())).toBe("third_party");
  });
});

describe("buildConnectPaymentIntentData", () => {
  it("principal flow → undefined (no transfer/fee/on_behalf_of)", () => {
    expect(
      buildConnectPaymentIntentData({ flow: "usha_principal", payee: payee(), applicationFeeOre: 1000 })
    ).toBeUndefined();
  });

  it("third_party WITH card_payments → on_behalf_of + descriptor + transfer + fee", () => {
    const pid = buildConnectPaymentIntentData({
      flow: "third_party",
      payee: payee({ card_payments_enabled: true, company_name: "Joy Nation AB" }),
      applicationFeeOre: 1500,
    })!;
    expect(pid.transfer_data?.destination).toBe("acct_123");
    expect(pid.on_behalf_of).toBe("acct_123");
    expect(pid.application_fee_amount).toBe(1500);
    expect(pid.statement_descriptor_suffix).toBe("Joy Nation AB");
  });

  it("third_party WITHOUT card_payments → transfer + fee but NO on_behalf_of (fallback)", () => {
    const pid = buildConnectPaymentIntentData({
      flow: "third_party",
      payee: payee({ card_payments_enabled: false }),
      applicationFeeOre: 1500,
    })!;
    expect(pid.transfer_data?.destination).toBe("acct_123");
    expect(pid.application_fee_amount).toBe(1500);
    expect(pid.on_behalf_of).toBeUndefined();
    expect(pid.statement_descriptor_suffix).toBeUndefined();
  });

  it("zero fee (gage) → no application_fee_amount", () => {
    const pid = buildConnectPaymentIntentData({
      flow: "third_party",
      payee: payee({ card_payments_enabled: true }),
      applicationFeeOre: 0,
    })!;
    expect(pid.application_fee_amount).toBeUndefined();
    expect(pid.transfer_data?.destination).toBe("acct_123");
  });

  it("missing stripe account → undefined", () => {
    expect(
      buildConnectPaymentIntentData({
        flow: "third_party",
        payee: payee({ stripe_account_id: null }),
        applicationFeeOre: 100,
      })
    ).toBeUndefined();
  });
});

describe("buildStatementDescriptorSuffix", () => {
  it("strips forbidden chars and trims to 22", () => {
    expect(buildStatementDescriptorSuffix("Café <Jazz*> Night Productions AB")).toBe(
      "Cafe Jazz Night Produc"
    );
  });
  it("empty/short → undefined", () => {
    expect(buildStatementDescriptorSuffix("")).toBeUndefined();
    expect(buildStatementDescriptorSuffix("*")).toBeUndefined();
    expect(buildStatementDescriptorSuffix(null)).toBeUndefined();
  });
});

describe("receiptSeller", () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD, USHA_LEGAL_NAME: "Usha AB", USHA_ORG_NUMBER: "5594018326" };
  });
  afterEach(() => {
    process.env = OLD;
  });

  it("principal → Usha legal name + org.nr", () => {
    expect(receiptSeller("usha_principal", { company_name: null, org_number: null, full_name: null })).toEqual({
      name: "Usha AB",
      orgNumber: "5594018326",
    });
  });
  it("third_party with company + org → formatted org.nr", () => {
    expect(
      receiptSeller("third_party", { company_name: "Joy Nation AB", org_number: "5560360793", full_name: "Anna" })
    ).toEqual({ name: "Joy Nation AB", orgNumber: "556036-0793" });
  });
  it("third_party individual (no org.nr) → legal name only", () => {
    expect(
      receiptSeller("third_party", { company_name: null, org_number: null, full_name: "Anna Andersson" })
    ).toEqual({ name: "Anna Andersson" });
  });
});
