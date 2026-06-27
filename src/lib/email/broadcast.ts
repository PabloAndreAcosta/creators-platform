import { getResend, getFromEmail } from "./resend";

// Lucka 2 — väntelista-utskick: HTML-bygge, validering och batch-sändning.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Host-skriven brödtext → säker HTML (escaped, radbrytningar bevarade). */
export function bodyToHtml(body: string): string {
  return escapeHtml(body).replace(/\r?\n/g, "<br>");
}

/** En CTA-länk får bara vara en absolut http(s)-URL (aldrig javascript: m.m.). */
export function isValidCtaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface BroadcastHtmlOpts {
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  unsubscribeUrl: string;
}

/** Bygg en mottagares mejl-HTML. CTA visas bara om både text och giltig URL finns. */
export function buildBroadcastHtml({ body, ctaLabel, ctaUrl, unsubscribeUrl }: BroadcastHtmlOpts): string {
  const cta =
    ctaLabel && ctaUrl && isValidCtaUrl(ctaUrl)
      ? `<p style="margin:28px 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 28px;background:#c8a445;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
  <div style="font-size:15px;line-height:1.6;">${bodyToHtml(body)}</div>
  ${cta}
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px;">
  <p style="color:#999;font-size:12px;line-height:1.5;">
    Du får detta mejl för att du anmälde dig till väntelistan på Usha Platform.<br>
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#999;">Avregistrera dig</a>
  </p>
</div>`;
}

export interface BroadcastRecipient {
  email: string;
  name?: string | null;
  unsubscribeUrl: string;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 600;

/**
 * Skicka samma utskick (med per-mottagare avregistreringslänk) i batchar via
 * Resend, med en kort paus mellan batchar för att inte slå i rate-limits.
 * Returnerar antal som lyckades respektive misslyckades.
 */
export async function sendBroadcast(params: {
  recipients: BroadcastRecipient[];
  subject: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): Promise<{ sent: number; failed: number }> {
  const resend = getResend();
  const from = getFromEmail();
  let sent = 0;
  let failed = 0;

  for (const group of chunk(params.recipients, BATCH_SIZE)) {
    const payload = group.map((r) => ({
      from,
      to: r.email,
      subject: params.subject,
      html: buildBroadcastHtml({
        body: params.body,
        ctaLabel: params.ctaLabel,
        ctaUrl: params.ctaUrl,
        unsubscribeUrl: r.unsubscribeUrl,
      }),
    }));

    try {
      const { error } = await resend.batch.send(payload);
      if (error) {
        console.error("broadcast batch error:", error);
        failed += group.length;
      } else {
        sent += group.length;
      }
    } catch (e) {
      console.error("broadcast batch threw:", e);
      failed += group.length;
    }

    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  return { sent, failed };
}
