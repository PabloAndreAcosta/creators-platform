/**
 * Usha onboarding & payment domain model.
 *
 * Source of truth: Usha_byggspec_onboarding.md (§4–§6). This is a standalone,
 * mock-stage module — it does NOT touch the live profiles/bookings tables.
 * No real payments are wired; all external calls go through mock adapters.
 */

// ─── Roles & tracks (§3, §4) ───────────────────────────────────────────────

export type Role = "creator" | "venue";

/** Creator tracks. C1 self-employed, C2 employed-via-EOR, C3 volunteer, C4 nonprofit. */
export type CreatorTrack = "C1" | "C2" | "C3" | "C4";
/** Venue tracks. V1 company, V2 association/culture house, V3 public sector. */
export type VenueTrack = "V1" | "V2" | "V3";
export type Track = CreatorTrack | VenueTrack;

export const CREATOR_TRACKS: CreatorTrack[] = ["C1", "C2", "C3", "C4"];
export const VENUE_TRACKS: VenueTrack[] = ["V1", "V2", "V3"];

export function isCreatorTrack(t: Track): t is CreatorTrack {
  return (CREATOR_TRACKS as string[]).includes(t);
}
export function isVenueTrack(t: Track): t is VenueTrack {
  return (VENUE_TRACKS as string[]).includes(t);
}

// ─── F-skatt (§7 G2) ────────────────────────────────────────────────────────

export type FskattStatus = "active" | "inactive" | "unknown";

// ─── Entities (§5) ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  bankid_verified: boolean;
  name: string | null;
  personal_no: string | null;
  email: string | null;
  phone: string | null;
  tax_residence_country: string | null;
  created_at: string;
}

export interface CreatorProfile {
  user_id: string;
  track: CreatorTrack;
  org_no?: string | null;
  fskatt_status: FskattStatus;
  fskatt_checked_at: string | null;
  vat_no?: string | null;
  stripe_account_id?: string | null;
  eor_worker_id?: string | null;
  bank_account?: string | null;
}

export interface VenueProfile {
  user_id: string;
  type: VenueTrack;
  org_no: string;
  vat_no?: string | null;
  billing_info?: string | null;
  po_reference?: string | null;
}

// ─── Booking & payout states (§6) ─────────────────────────────────────────────

export type BookingStatus =
  | "requested"
  | "accepted"
  | "in_escrow"
  | "completed"
  | "settled"
  | "disputed"
  | "cancelled"
  | "refunded";

export type PayoutState =
  | "pending"
  | "held" // held at PSP/EOR — never at Usha (§1.2)
  | "released"
  | "paid"
  | "blocked"
  | "failed";

export type PayoutProvider = "stripe" | "eor";

/**
 * A volunteer (C3) may only ever receive an expense reimbursement, never a real
 * payout (§1.6, G3). The kind is part of the money flow, not derived from role.
 */
export type PayoutKind = "payout" | "expense_reimbursement";

export interface Booking {
  id: string;
  venue_id: string;
  creator_id: string;
  amount_gross: number;
  commission: number;
  status: BookingStatus;
  created_at: string;
  completed_at?: string | null;
  /** G6: set when VAT must be computed on commission only ("annans namn"). */
  vat_on_commission_only?: boolean;
}

export interface Payout {
  id: string;
  booking_id: string;
  provider: PayoutProvider;
  state: PayoutState;
  kind: PayoutKind;
  gross: number;
  tax: number;
  fees: number;
  commission: number;
  net: number;
  released_at?: string | null;
}

export interface Dac7Record {
  seller_id: string;
  quarter: number; // 1–4
  year: number;
  consideration: number;
  currency: string;
}
