import { validateCalendarIcsUrl } from "./ics-import";

export const ICS_FETCH_TIMEOUT_MS = 8_000;
export const ICS_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export type IcsFetchError = "invalidUrl" | "timeout" | "tooLarge" | "http" | "notCalendar" | "network";

/**
 * Hämtar en extern kalender från servern. Bara https mot de tillåtna värdarna;
 * omdirigeringar följs manuellt och varje hopp kontrolleras igen, så en
 * omdirigering till en annan värd stoppas. Tidsgräns och storlekstak gör att en
 * jättekalender eller en server som aldrig svarar inte binder upp funktionen.
 *
 * Adressen är en hemlig nyckel: den loggas aldrig och skickas aldrig tillbaka.
 */
export async function fetchCalendarIcs(
  rawUrl: string
): Promise<{ ok: true; text: string } | { ok: false; error: IcsFetchError; status?: number }> {
  const first = validateCalendarIcsUrl(rawUrl);
  if (!first.ok) return { ok: false, error: "invalidUrl" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ICS_FETCH_TIMEOUT_MS);
  try {
    let url = first.url;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "text/calendar, text/plain;q=0.5" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, error: "http", status: res.status };
        const next = validateCalendarIcsUrl(new URL(location, url).toString());
        if (!next.ok) return { ok: false, error: "invalidUrl" };
        url = next.url;
        res = null;
        continue;
      }
      break;
    }
    if (!res) return { ok: false, error: "http" };
    if (!res.ok) return { ok: false, error: "http", status: res.status };

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > ICS_MAX_BYTES) return { ok: false, error: "tooLarge" };

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: "network" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > ICS_MAX_BYTES) {
        await reader.cancel();
        return { ok: false, error: "tooLarge" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder("utf-8").decode(bytes);
    if (!text.includes("BEGIN:VCALENDAR")) return { ok: false, error: "notCalendar" };
    return { ok: true, text };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return { ok: false, error: "timeout" };
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}
