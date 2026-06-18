/**
 * Onboarding router (§3). Pure step-machine: given the answers collected so far,
 * decide the current screen and the resolved track. No side effects.
 *
 *   S0 BankID → S1 Role
 *     Creator → K1 (own company + F-skatt?)
 *                 yes        → C1 (self-employed)
 *                 no         → K2 (how to get paid?)
 *                                salary    → C2 (employed via EOR)
 *                                volunteer → C3 (volunteer)
 *                 nonprofit  → C4 (association)
 *     Venue   → V1 (type?)  company → V1 · association → V2 · public → V3
 */

import type { Role, Track, CreatorTrack, VenueTrack } from "./types";

export type Step =
  | "S0_BANKID"
  | "S1_ROLE"
  | "K1_COMPANY"
  | "K2_PAYMENT"
  | "C1_FORM"
  | "C2_FORM"
  | "C3_FORM"
  | "C4_FORM"
  | "V1_TYPE"
  | "V_FORM"
  | "DONE"
  | "ESCROW_INFO";

export type CompanyAnswer = "company" | "none" | "nonprofit";
export type PaymentAnswer = "salary" | "volunteer";
export type VenueTypeAnswer = "company" | "association" | "public";

export interface OnboardingAnswers {
  bankIdVerified?: boolean;
  role?: Role;
  /** K1 */
  company?: CompanyAnswer;
  /** K2 */
  payment?: PaymentAnswer;
  /** V1 */
  venueType?: VenueTypeAnswer;
}

/**
 * Resolves the track from the answers, or null if not enough has been answered.
 * G7-substance note: the track is derived strictly from the answered questions,
 * never assigned by editable role label (§1.7).
 */
export function resolveTrack(a: OnboardingAnswers): Track | null {
  if (a.role === "creator") {
    if (a.company === "company") return "C1";
    if (a.company === "nonprofit") return "C4";
    if (a.company === "none") {
      if (a.payment === "salary") return "C2";
      if (a.payment === "volunteer") return "C3";
      return null;
    }
    return null;
  }
  if (a.role === "venue") {
    if (a.venueType === "company") return "V1";
    if (a.venueType === "association") return "V2";
    if (a.venueType === "public") return "V3";
    return null;
  }
  return null;
}

const TRACK_TO_FORM_STEP: Record<Track, Step> = {
  C1: "C1_FORM",
  C2: "C2_FORM",
  C3: "C3_FORM",
  C4: "C4_FORM",
  V1: "V_FORM",
  V2: "V_FORM",
  V3: "V_FORM",
};

/**
 * The screen the user should currently see, given their answers. BankID is the
 * hard first gate (§1.3, G1): nothing past S0 without bankIdVerified.
 */
export function currentStep(a: OnboardingAnswers): Step {
  if (!a.bankIdVerified) return "S0_BANKID";
  if (!a.role) return "S1_ROLE";

  if (a.role === "creator") {
    if (!a.company) return "K1_COMPANY";
    if (a.company === "company") return "C1_FORM";
    if (a.company === "nonprofit") return "C4_FORM";
    // company === "none"
    if (!a.payment) return "K2_PAYMENT";
    return a.payment === "salary" ? "C2_FORM" : "C3_FORM";
  }

  // venue
  if (!a.venueType) return "V1_TYPE";
  return "V_FORM";
}

/** The "Back" target for a given step (mirrors the wireframe). */
export function previousStep(step: Step, a: OnboardingAnswers): Step | null {
  switch (step) {
    case "S0_BANKID":
      return null;
    case "S1_ROLE":
      return "S0_BANKID";
    case "K1_COMPANY":
    case "V1_TYPE":
      return "S1_ROLE";
    case "K2_PAYMENT":
      return "K1_COMPANY";
    case "C1_FORM":
    case "C4_FORM":
      return "K1_COMPANY";
    case "C2_FORM":
    case "C3_FORM":
      return "K2_PAYMENT";
    case "V_FORM":
      return "V1_TYPE";
    case "DONE":
      return a.role === "venue" ? "V_FORM" : null;
    case "ESCROW_INFO":
      return "DONE";
    default:
      return null;
  }
}

export function formStepForTrack(track: Track): Step {
  return TRACK_TO_FORM_STEP[track];
}

// ─── Fields collected per track (§4) ──────────────────────────────────────────

export interface FieldSpec {
  key: string;
  label: string;
  required: boolean;
  /** Shown conditionally (e.g. VAT field hidden for non-registered association). */
  conditional?: boolean;
}

/** Common fields for everyone (§4 footer). */
export const COMMON_FIELDS: FieldSpec[] = [
  { key: "legal_name", label: "Namn / firmanamn", required: true },
  { key: "id_no", label: "Person-/org.nr", required: true },
  { key: "address", label: "Adress", required: true },
  { key: "tax_residence_country", label: "Skatterättslig hemvist (land)", required: true },
  { key: "bank_account", label: "Bankkonto / IBAN", required: true },
];

export const TRACK_FIELDS: Record<Track, FieldSpec[]> = {
  C1: [
    { key: "org_no", label: "Organisationsnummer", required: true },
    { key: "fskatt_status", label: "F-skattestatus (auto)", required: true },
    { key: "vat_no", label: "Momsreg.nr", required: false },
    { key: "stripe_account_id", label: "Stripe-konto", required: true },
  ],
  C2: [
    { key: "personal_no", label: "Personnummer", required: true },
    { key: "bank_account", label: "Bankkonto för lön", required: true },
    { key: "tax_table", label: "Skattetabell / jämkning", required: true },
    { key: "insurance_consent", label: "Försäkringssamtycke", required: true },
  ],
  C3: [
    { key: "bank_account", label: "Bankkonto (utlägg)", required: true },
    { key: "receipts", label: "Kvitton", required: false },
    { key: "volunteer_attestation", label: "Intygande: ingen ersättning/förmån", required: true },
  ],
  C4: [
    { key: "org_no", label: "Organisationsnummer", required: true },
    { key: "signatory", label: "Firmatecknare", required: true },
    { key: "bankgiro", label: "Bankgiro", required: true },
    { key: "vat_status", label: "Momsstatus", required: true },
  ],
  V1: [
    { key: "org_no", label: "Organisationsnummer", required: true },
    { key: "vat_no", label: "Momsreg.nr", required: true },
    { key: "billing_info", label: "Faktureringsuppgifter", required: true },
  ],
  V2: [
    { key: "org_no", label: "Organisationsnummer", required: true },
    { key: "vat_status", label: "Momsstatus", required: true },
    { key: "contact_person", label: "Kontaktperson", required: true },
    // VAT reg. number hidden — association is not VAT-registered (G6).
  ],
  V3: [
    { key: "org_no", label: "Organisationsnummer", required: true },
    { key: "vat_no", label: "Momsreg.nr", required: true },
    { key: "po_reference", label: "PO / referens", required: true },
    { key: "framework_agreement", label: "Ramavtal (ev.)", required: false },
  ],
};

export function fieldsForTrack(track: Track): FieldSpec[] {
  return [...COMMON_FIELDS, ...TRACK_FIELDS[track]];
}

export type { CreatorTrack, VenueTrack };
