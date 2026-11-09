import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Swish Företag via Nordea (avtal 565622, tecknat 2026-11-06).
 *
 * Numret ligger i app_config under `swish_number` så det går att byta eller
 * stänga av utan deploy. Pengarna landar på Usha AB:s bankkonto, utanför
 * Stripe — därför får Swish bara erbjudas för evenemang där Usha själv är
 * säljare (is_usha_owned_seller). För en tredje parts kväll vore det att ta
 * emot någon annans pengar på vårt konto.
 */
const TTL_MS = 5 * 60_000;
let cached: { value: string | null; at: number } | null = null;

export async function getSwishNumber(admin: SupabaseClient): Promise<string | null> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  let value: string | null = null;
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "swish_number").maybeSingle();
    const raw = typeof data?.value === "string" ? data.value : data?.value != null ? String(data.value) : "";
    const digits = raw.replace(/\D/g, "");
    if (/^123\d{7}$/.test(digits)) value = digits;
  } catch {
    // ingen Swish vid läsfel
  }
  cached = { value, at: now };
  return value;
}

export function clearSwishNumberCache() {
  cached = null;
}

/** 1237111180 → "123 711 11 80" */
export function formatSwishNumber(n: string): string {
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
}

/**
 * Swish-länken som QR-koden bär. Öppnar Swish-appen med nummer, belopp och
 * meddelande förifyllda och låsta (ingen `edit`-parameter = gästen kan inte
 * ändra beloppet). Meddelandet får vara högst 50 tecken enligt Swish.
 */
export function swishPaymentUrl(p: { number: string; amountSek: number; message: string }): string {
  // Enligt Swishs specifikation (developer.swish.nu, "Generate QR codes"):
  // sw, amt (decimalpunkt), msg (URL-kodad); utan `edit` är båda låsta.
  const amt = Math.max(1, Math.round(p.amountSek)).toFixed(2);
  const msg = p.message.replace(/[^\p{L}\p{N} .,:/-]/gu, "").trim().slice(0, 50);
  const q = new URLSearchParams({ sw: p.number, amt, msg });
  return `https://app.swish.nu/1/p/sw/?${q.toString()}`;
}

/** Meddelandet gästen ser i Swish: kväll + datum, kort nog att känna igen. */
export function swishMessage(title: string, eventDate: string | null): string {
  const short = title.replace(/\s*[–-]\s*.*$/, "").trim() || title;
  const d = eventDate ? ` ${eventDate.slice(5).replace("-", "/")}` : "";
  return `${short}${d}`.slice(0, 50);
}
