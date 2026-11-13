"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appPathFromUrl, getNativePlatform, nativePlugin } from "@/lib/native";

interface SharePlugin {
  share(options: { title?: string; text?: string; url?: string }): Promise<unknown>;
}

interface ListenerHandle {
  remove(): Promise<void>;
}

interface AppPlugin {
  addListener(
    event: "appUrlOpen",
    cb: (event: { url: string }) => void,
  ): Promise<ListenerHandle> | ListenerHandle;
  addListener(
    event: "backButton",
    cb: (event: { canGoBack: boolean }) => void,
  ): Promise<ListenerHandle> | ListenerHandle;
  exitApp(): Promise<void>;
}

/**
 * Kopplar webbappen till det native skalet när den körs i App Store-/Play-appen.
 * Renderar inget och gör inget i webbläsaren.
 *
 * - Märker <html data-native="ios|android"> så CSS och komponenter kan anpassa sig.
 * - Ger navigator.share en native delningsruta (WKWebView saknar Web Share).
 * - Öppnar djuplänkar (usha:// och https://usha.se/...) i appens router.
 * - Android-bakåtknappen går bakåt i historiken och stänger appen från startsidan.
 */
export function NativeShellBridge() {
  const router = useRouter();

  useEffect(() => {
    const platform = getNativePlatform();
    if (!platform) return;
    document.documentElement.dataset.native = platform;

    if (typeof navigator.share !== "function") {
      const share = nativePlugin<SharePlugin>("Share");
      if (share) {
        navigator.share = async (data?: ShareData) => {
          await share.share({ title: data?.title, text: data?.text, url: data?.url });
        };
      }
    }

    const app = nativePlugin<AppPlugin>("App");
    if (!app) return;

    const handles: Array<Promise<ListenerHandle> | ListenerHandle> = [
      app.addListener("appUrlOpen", ({ url }) => {
        const path = appPathFromUrl(url);
        if (path) router.push(path);
      }),
      app.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void app.exitApp();
      }),
    ];

    return () => {
      for (const handle of handles) {
        void Promise.resolve(handle).then((h) => h?.remove?.());
      }
    };
  }, [router]);

  return null;
}
