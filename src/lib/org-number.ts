// Swedish organisationsnummer helpers + free EU VIES VAT verification.
// No API key, no cost. VIES confirms the company is VAT-registered and returns
// the official registered name.

/**
 * Normalize and Luhn-validate a Swedish org-nr. Returns the 10-digit string
 * (no hyphen) or null if it's not a structurally valid org-nr.
 */
export function normalizeOrgNumber(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  // Drop an optional 12-digit "16" century prefix (16NNNNNNNNNN).
  const d = digits.length === 12 && digits.startsWith("16") ? digits.slice(2) : digits;
  if (d.length !== 10) return null;
  return luhnValid(d) ? d : null;
}

function luhnValid(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = d.charCodeAt(i) - 48;
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Pretty format as NNNNNN-NNNN. Utländska momsnummer (EL123…) visas som de är. */
export function formatOrgNumber(d: string): string {
  return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : d;
}

export type ViesResult =
  | { status: "valid"; name: string; address: string }
  | { status: "invalid" }
  | { status: "unavailable"; reason: string };

/**
 * Verify a Swedish org-nr against the EU VIES VAT registry (free, no key).
 * Swedish VAT number = org-nr (10 digits) + "01". Distinguishes a genuine
 * INVALID (not VAT-registered) from transient member-state errors
 * (MS_MAX_CONCURRENT_REQ, MS_UNAVAILABLE, TIMEOUT, …) which should be retried,
 * never treated as a rejection.
 */
export async function verifyViaVies(orgDigits: string): Promise<ViesResult> {
  return verifyVatViaVies("SE", `${orgDigits}01`);
}

/**
 * EU-länderna i VIES med sina momsprefix. Grekland heter EL i VIES, inte GR;
 * XI är Nordirland. Sverige hanteras via organisationsnumret ovan.
 */
export const VIES_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR", "HU", "IE",
  "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI",
] as const;
export type ViesCountry = (typeof VIES_COUNTRIES)[number];

export type CompanyId =
  | { country: "SE"; stored: string; org: string }
  | { country: ViesCountry; stored: string; vat: string };

/**
 * Tolka det användaren skrivit: ett svenskt organisationsnummer, eller ett
 * EU-momsnummer med landsprefix (t.ex. EL123456789, DE123456789). Byggt
 * 2026-11-07 så att kreatörer med bolag i andra EU-länder kan verifiera sig.
 *
 * `stored` är det som sparas i profiles.org_number: tio siffror för svenska
 * bolag (som förut), annars prefix + nummer.
 */
export function parseCompanyId(input: string): CompanyId | null {
  const raw = (input || "").toUpperCase().replace(/[\s.\-]/g, "");
  const m = raw.match(/^([A-Z]{2})([0-9A-Z+*]{2,13})$/);
  if (m) {
    const cc = (m[1] === "GR" ? "EL" : m[1]) as ViesCountry;
    if (!(VIES_COUNTRIES as readonly string[]).includes(cc)) return null;
    if (cc === "SE") {
      // SE + org.nr + 01, eller bara SE + org.nr.
      const digits = m[2].replace(/01$/, "");
      const org = normalizeOrgNumber(digits);
      return org ? { country: "SE", stored: org, org } : null;
    }
    return { country: cc, stored: `${cc}${m[2]}`, vat: m[2] };
  }
  const org = normalizeOrgNumber(input);
  return org ? { country: "SE", stored: org, org } : null;
}

/** Kontrollera ett momsnummer i VIES för valfritt EU-land. */
export async function verifyVatViaVies(country: ViesCountry, vat: string): Promise<ViesResult> {
  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${encodeURIComponent(vat)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return { status: "unavailable", reason: `http_${res.status}` };
    const data = await res.json();
    const err = String(data?.userError ?? "");
    if (data?.isValid === true && err === "VALID") {
      return {
        status: "valid",
        name: String(data.name ?? "").trim(),
        address: String(data.address ?? "").trim(),
      };
    }
    if (err === "INVALID") return { status: "invalid" };
    return { status: "unavailable", reason: err || "unknown" };
  } catch {
    return { status: "unavailable", reason: "network" };
  }
}
