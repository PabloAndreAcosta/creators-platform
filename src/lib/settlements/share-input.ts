/**
 * Validering av ett delningsavtal innan det sparas.
 *
 * Ren funktion, eftersom den avgör hur pengar fördelas och därför måste gå att
 * testa uttömmande utan databas.
 */

export interface ShareInput {
  partnerPercent: unknown;
  vatRate: unknown;
  payoutDelayDays: unknown;
}

export interface ValidShare {
  partnerPercent: number;
  vatRate: number;
  payoutDelayDays: number;
}

export type ShareValidation =
  | { ok: true; value: ValidShare }
  | { ok: false; error: "percent" | "vat" | "delay" };

/**
 * Momsen anges i procent i formuläret (25) men lagras som decimal (0.25).
 * Att låta användaren skriva 0,25 hade inbjudit till att någon skriver 25 och
 * får tjugofem gånger för mycket moms avdraget.
 */
/**
 * Number(null), Number(undefined) och Number("") ger 0 respektive NaN utan att
 * klaga. Ett tomt momsfält hade därför tyst betytt NOLL moms, och partnern fått
 * en större andel än avsett. Tomt är inte noll — det är ett saknat svar.
 */
function tal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function validateShareInput(input: ShareInput): ShareValidation {
  const percent = tal(input.partnerPercent) ?? NaN;
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    return { ok: false, error: "percent" };
  }

  const vatPercent = tal(input.vatRate) ?? NaN;
  if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent >= 100) {
    return { ok: false, error: "vat" };
  }

  const delay = tal(input.payoutDelayDays) ?? NaN;
  if (!Number.isInteger(delay) || delay < 0 || delay > 30) {
    return { ok: false, error: "delay" };
  }

  return {
    ok: true,
    value: {
      partnerPercent: percent,
      // Avrundas till tre decimaler, samma precision som kolumnen. Utan det kan
      // 8,25 % bli 0.0825000000001 och skilja sig från vad som visas.
      vatRate: Math.round((vatPercent / 100) * 1000) / 1000,
      payoutDelayDays: delay,
    },
  };
}
