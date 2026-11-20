"use client";

import type { Provider, SupabaseClient } from "@supabase/supabase-js";
import { nativePlugin } from "@/lib/native";

/**
 * Google och Facebook vägrar logga in i en inbäddad webbvy, och i Android-skalet
 * öppnas deras sidor annars i Chrome — sessionen hamnar då i Chrome och inte i
 * appen. I skalet går inloggningen därför via en webbläsarflik (Custom Tab /
 * SFSafariViewController) som delar Chromes inloggning, och kommer tillbaka via
 * usha://callback. Skalets brygga (native-shell-bridge) stänger fliken och
 * låter /callback växla in koden i appens egen webbvy, där PKCE-nyckeln ligger.
 */

interface BrowserPlugin {
  open(options: { url: string; presentationStyle?: "fullscreen" | "popover" }): Promise<void>;
  close(): Promise<void>;
}

export const NATIVE_CALLBACK_PREFIX = "usha://callback";

/** https://usha.se/callback?next=/x → usha://callback?next=/x */
export function nativeRedirectFor(webRedirect: string): string {
  try {
    return `${NATIVE_CALLBACK_PREFIX}${new URL(webRedirect).search}`;
  } catch {
    return NATIVE_CALLBACK_PREFIX;
  }
}

export async function signInWithOAuthAnywhere(
  supabase: SupabaseClient,
  provider: Provider,
  redirectTo: string,
  queryParams?: Record<string, string>,
): Promise<void> {
  const browser = nativePlugin<BrowserPlugin>("Browser");
  if (!browser) {
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, queryParams } });
    return;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: nativeRedirectFor(redirectTo), queryParams, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw error ?? new Error("OAuth URL saknas");
  await browser.open({ url: data.url, presentationStyle: "popover" });
}

/** Kallas av bryggan när appen öppnas via usha://callback?... */
export async function closeOAuthBrowser(): Promise<void> {
  const browser = nativePlugin<BrowserPlugin>("Browser");
  await browser?.close().catch(() => {});
}
