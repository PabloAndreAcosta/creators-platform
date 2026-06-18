/**
 * External-integration adapters.
 *
 * Every external service from §2 sits behind an interface here. In this stage
 * ALL implementations are MOCKS — no real BankID, Stripe, EOR or Skatteverket
 * calls, and no real money moves. Swapping in real implementations is gated on
 * the legal sign-off in §9 (see config.PAYMENTS_LIVE).
 */

import { PAYMENTS_LIVE } from "../config";
import type { Dac7Record, FskattStatus } from "../types";

function assertMockMoneyAllowed(op: string): void {
  // Hard stop: a money-moving mock must never be mistaken for a live integration.
  if (PAYMENTS_LIVE) {
    throw new Error(
      `${op}: PAYMENTS_LIVE is true but only a MOCK adapter is wired. Real payments are blocked until §9 legal sign-off and real adapters are implemented.`,
    );
  }
}

// ─── BankID (§2) ──────────────────────────────────────────────────────────────

export interface BankIdResult {
  verified: boolean;
  name: string;
  personalNo: string;
}
export interface BankIdAdapter {
  authenticate(): Promise<BankIdResult>;
}

export const mockBankId: BankIdAdapter = {
  async authenticate() {
    return { verified: true, name: "Test Testsson", personalNo: "199001011234" };
  },
};

// ─── Stripe Connect / PSP (§2, §6 escrow) ─────────────────────────────────────

export interface PspChargeResult {
  chargeId: string;
  state: "held";
}
export interface PspTransferResult {
  transferId: string;
  state: "paid";
}
export interface PspAdapter {
  createConnectedAccount(input: { userId: string }): Promise<{ accountId: string; onboardingUrl: string }>;
  /** Escrow variant: charge the buyer and HOLD the funds at the PSP (never at Usha). */
  chargeAndHold(input: { bookingId: string; amountGross: number }): Promise<PspChargeResult>;
  /** Release after completion: transfer net to payee, commission as application fee to Usha. */
  releaseTransfer(input: { bookingId: string; net: number; commission: number; payeeAccount: string }): Promise<PspTransferResult>;
  refund(input: { chargeId: string }): Promise<{ refundId: string; state: "refunded" }>;
}

export const mockPsp: PspAdapter = {
  async createConnectedAccount({ userId }) {
    return { accountId: `acct_mock_${userId}`, onboardingUrl: `https://mock.stripe/onboard/${userId}` };
  },
  async chargeAndHold({ bookingId }) {
    assertMockMoneyAllowed("PSP.chargeAndHold");
    return { chargeId: `ch_mock_${bookingId}`, state: "held" };
  },
  async releaseTransfer({ bookingId }) {
    assertMockMoneyAllowed("PSP.releaseTransfer");
    return { transferId: `tr_mock_${bookingId}`, state: "paid" };
  },
  async refund({ chargeId }) {
    assertMockMoneyAllowed("PSP.refund");
    return { refundId: `re_mock_${chargeId}`, state: "refunded" };
  },
};

// ─── EOR / Gigapay (§2, C2) ───────────────────────────────────────────────────

export interface EorAdapter {
  registerWorker(input: { userId: string; personalNo: string }): Promise<{ workerId: string }>;
  createAssignment(input: { workerId: string; bookingId: string; amountGross: number }): Promise<{ assignmentId: string }>;
  /** EOR is the employer: it withholds tax/fees and pays salary. Funds never via Usha. */
  paySalary(input: { assignmentId: string }): Promise<{ state: "paid" }>;
}

export const mockEor: EorAdapter = {
  async registerWorker({ userId }) {
    return { workerId: `worker_mock_${userId}` };
  },
  async createAssignment({ bookingId }) {
    return { assignmentId: `asg_mock_${bookingId}` };
  },
  async paySalary() {
    assertMockMoneyAllowed("EOR.paySalary");
    return { state: "paid" };
  },
};

// ─── Skatteverket F-skatt (§2, G2) ────────────────────────────────────────────

export interface FskattAdapter {
  check(orgNo: string): Promise<{ status: FskattStatus; checkedAt: string }>;
}

export const mockFskatt: FskattAdapter = {
  async check(orgNo) {
    // Mock: a plausible Swedish org number (10 digits, optionally with dash) is
    // treated as active; anything else is unknown.
    const digits = orgNo.replace(/\D/g, "");
    return {
      status: digits.length === 10 ? "active" : "unknown",
      checkedAt: new Date().toISOString(),
    };
  },
};

// ─── DAC7 reporting (§2, G7) ──────────────────────────────────────────────────

export interface Dac7Adapter {
  log(record: Dac7Record): Promise<void>;
  exportQuarter(quarter: number, year: number): Promise<Dac7Record[]>;
}

/** In-memory mock store, useful for tests and the demo flow. */
export function createMockDac7(): Dac7Adapter & { _store: Dac7Record[] } {
  const store: Dac7Record[] = [];
  return {
    _store: store,
    async log(record) {
      const i = store.findIndex(
        (r) => r.seller_id === record.seller_id && r.quarter === record.quarter && r.year === record.year,
      );
      if (i >= 0) store[i] = { ...store[i], consideration: store[i].consideration + record.consideration };
      else store.push({ ...record });
    },
    async exportQuarter(quarter, year) {
      return store.filter((r) => r.quarter === quarter && r.year === year);
    },
  };
}

export const adapters = {
  bankId: mockBankId,
  psp: mockPsp,
  eor: mockEor,
  fskatt: mockFskatt,
  dac7: createMockDac7(),
} as const;
