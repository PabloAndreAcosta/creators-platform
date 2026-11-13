"use client";

import { useEffect, useState } from "react";

/**
 * Brygga mot det native skalet (Capacitor) för App Store / Google Play.
 *
 * Skalet laddar https://usha.se i en webbvy och injicerar `window.Capacitor`.
 * I vanliga webbläsare och i PWA:n finns objektet inte, så allt här är no-op
 * där. Importera aldrig @capacitor/* i webbkoden — pluginerna nås via den
 * injicerade bryggan så att webbpaketet inte växer.
 */

export type NativePlatform = "ios" | "android";

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  registerPlugin?: <T>(name: string) => T;
}

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

export function getNativePlatform(): NativePlatform | null {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const platform = cap.getPlatform?.();
  return platform === "ios" || platform === "android" ? platform : null;
}

export function isNativeApp(): boolean {
  return getNativePlatform() !== null;
}

/** Hämtar ett native-plugin via bryggan, eller null utanför skalet. */
export function nativePlugin<T>(name: string): T | null {
  if (typeof window === "undefined") return null;
  const register = window.Capacitor?.registerPlugin;
  if (!isNativeApp() || !register) return null;
  return register<T>(name);
}

/** null tills komponenten monterats (SSR-säkert), sedan plattformen eller null. */
export function useNativePlatform(): NativePlatform | null {
  const [platform, setPlatform] = useState<NativePlatform | null>(null);
  useEffect(() => {
    setPlatform(getNativePlatform());
  }, []);
  return platform;
}

const APP_HOSTS = new Set(["usha.se", "www.usha.se"]);

/**
 * Översätter en länk som öppnade appen till en intern sökväg.
 *   usha://app/events/123      → /app/events/123
 *   usha:///app/events/123     → /app/events/123
 *   https://usha.se/biljett/x  → /biljett/x
 * Allt annat (andra domäner, okända scheman) ger null och ignoreras.
 */
export function appPathFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol === "usha:") {
    const host = url.host; // "app" i usha://app/x, "" i usha:///app/x
    const path = `${host ? `/${host}` : ""}${url.pathname}` || "/";
    return normalise(path, url);
  }
  if ((url.protocol === "https:" || url.protocol === "http:") && APP_HOSTS.has(url.hostname)) {
    return normalise(url.pathname || "/", url);
  }
  return null;
}

function normalise(path: string, url: URL): string {
  const clean = path.replace(/\/{2,}/g, "/");
  return `${clean.startsWith("/") ? clean : `/${clean}`}${url.search}${url.hash}`;
}
