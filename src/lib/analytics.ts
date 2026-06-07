type GtagEventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event" | "config" | "js", action: string, params?: GtagEventParams | Date) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(name: string, params?: GtagEventParams): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}
