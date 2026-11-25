/**
 * Lätt lyssnare på fetch: tänder felknappen när ett anrop får 5xx eller inte
 * når fram alls. Den skickar ingenting själv och ändrar inte svaret — den tittar
 * bara på statuskoden och släpper igenom allt som det var.
 *
 * Sentrys egna anrop (tunneln /monitoring och *.sentry.io) räknas inte: når
 * Sentry inte fram ska det inte se ut som att sidan är trasig.
 * Ett avbrutet anrop (AbortError) är inget fel — det är koden som ångrade sig.
 */

const MARK = "__ushaFeedbackWatch";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type WatchWindow = { fetch: FetchLike } & Record<string, unknown>;

export function isTroubleStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

export function isIgnoredUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url, "https://usha.se");
  } catch {
    return false;
  }
  if (u.hostname === "sentry.io" || u.hostname.endsWith(".sentry.io")) return true;
  return u.pathname === "/monitoring" || u.pathname.startsWith("/monitoring/");
}

export function isAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url ?? "";
}

/**
 * Lindar window.fetch en gång. Ett andra anrop gör ingenting (snabb
 * navigering, React strict mode). Returnerar en funktion som tar bort lindningen
 * om den fortfarande är den yttersta.
 */
export function installFetchWatch(win: WatchWindow, onTrouble: () => void): () => void {
  if (win[MARK]) return () => {};
  const original = win.fetch;
  if (typeof original !== "function") return () => {};

  const wrapped: FetchLike = function (input, init) {
    const url = urlOf(input);
    const ignored = isIgnoredUrl(url);
    let p: Promise<Response>;
    try {
      p = original.call(win, input, init);
    } catch (err) {
      if (!ignored && !isAbort(err)) onTrouble();
      throw err;
    }
    return p.then(
      (res) => {
        if (!ignored && res && isTroubleStatus(res.status)) onTrouble();
        return res;
      },
      (err) => {
        if (!ignored && !isAbort(err)) onTrouble();
        throw err;
      },
    );
  };

  win.fetch = wrapped;
  win[MARK] = true;
  return () => {
    if (win.fetch === wrapped) win.fetch = original;
    delete win[MARK];
  };
}
