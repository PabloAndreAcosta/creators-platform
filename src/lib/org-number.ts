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

/** Pretty format as NNNNNN-NNNN. */
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
  const vat = `${orgDigits}01`;
  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SE/vat/${vat}`,
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
