/**
 * Appars inbyggda webbläsare (Messenger, Instagram, Facebook m.fl.).
 *
 * Google spärrar inloggning i dem ("disallowed_useragent"), och de delar inte
 * inloggning med telefonens vanliga webbläsare. Den som trycker på en
 * usha.se-länk i Messenger hamnar därför på inloggningssidan med en
 * Google-knapp som inte kan fungera. 2026-11-05 fastnade en volontär så.
 */
export type InAppBrowser = "Messenger" | "Facebook" | "Instagram" | "LinkedIn" | "TikTok" | "Snapchat";

export function detectInAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  if (!ua) return null;
  // Messenger före Facebook: båda bär FB_IAB/FBAN.
  if (/Orca-Android|MessengerForiOS|FBAN\/Messenger|FB_IAB\/MESSENGER/i.test(ua)) return "Messenger";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "TikTok";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  return null;
}

export function isAndroid(ua: string | null | undefined): boolean {
  return !!ua && /Android/i.test(ua);
}

/**
 * Länk som öppnar samma sida i Chrome på Android. Saknas Chrome faller
 * Android tillbaka på adressen själv.
 */
export function chromeIntentUrl(href: string): string {
  const u = new URL(href);
  const rest = `${u.host}${u.pathname}${u.search}${u.hash}`;
  return `intent://${rest}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
