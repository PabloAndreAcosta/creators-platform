import { describe, it, expect } from "vitest";
import { chromeIntentUrl, detectInAppBrowser, isAndroid } from "../in-app-browser";

const MESSENGER_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0.0.0;]";
const MESSENGER_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]";
const FACEBOOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0.0";
const CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("detectInAppBrowser", () => {
  it("känner igen Messenger på Android och iPhone", () => {
    expect(detectInAppBrowser(MESSENGER_ANDROID)).toBe("Messenger");
    expect(detectInAppBrowser(MESSENGER_IOS)).toBe("Messenger");
  });
  it("skiljer Facebook och Instagram från Messenger", () => {
    expect(detectInAppBrowser(FACEBOOK_ANDROID)).toBe("Facebook");
    expect(detectInAppBrowser(INSTAGRAM)).toBe("Instagram");
  });
  it("låter vanliga webbläsare vara", () => {
    expect(detectInAppBrowser(CHROME)).toBeNull();
    expect(detectInAppBrowser(SAFARI)).toBeNull();
    expect(detectInAppBrowser("")).toBeNull();
    expect(detectInAppBrowser(undefined)).toBeNull();
  });
  it("vet om telefonen är Android", () => {
    expect(isAndroid(MESSENGER_ANDROID)).toBe(true);
    expect(isAndroid(MESSENGER_IOS)).toBe(false);
  });
});

describe("chromeIntentUrl", () => {
  it("öppnar samma adress i Chrome, med adressen som reserv", () => {
    const href = "https://usha.se/login?next=%2Fapp%2Ftaxi%2Fabc";
    const url = chromeIntentUrl(href);
    expect(url.startsWith("intent://usha.se/login?next=%2Fapp%2Ftaxi%2Fabc#Intent;")).toBe(true);
    expect(url).toContain("scheme=https;");
    expect(url).toContain("package=com.android.chrome;");
    expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent(href)};end`);
  });
});
