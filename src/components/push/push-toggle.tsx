"use client";

import { useState, useEffect, useCallback } from "react";
import { BellRing, Loader2 } from "lucide-react";

// VAPID public key → Uint8Array for pushManager.subscribe.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "loading" | "unsupported" | "unconfigured" | "off" | "on" | "denied" | "busy";

/**
 * Toggle for Web Push on this device. Enabling asks the browser for permission,
 * subscribes via the service worker, and stores the subscription server-side so
 * the backend can push updates (ticket sales, cancellations, etc.).
 */
export function PushToggle() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setState("unsupported");
    if (!vapidKey) return setState("unconfigured");
    if (Notification.permission === "denied") return setState("denied");

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidKey]);

  const enable = useCallback(async () => {
    if (!vapidKey) return;
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }, [vapidKey]);

  const disable = useCallback(async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }, []);

  // Hide the row entirely where push can't work — keeps settings clean.
  if (state === "loading" || state === "unsupported" || state === "unconfigured") return null;

  const on = state === "on";
  const busy = state === "busy";
  const denied = state === "denied";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-4">
      <BellRing size={20} className="shrink-0 text-[var(--usha-gold)]" />
      <div className="flex-1">
        <p className="text-sm font-medium">Push-notiser på den här enheten</p>
        <p className="text-xs text-[var(--usha-muted)]">
          {denied
            ? "Notiser är blockerade i webbläsaren. Tillåt notiser för usha.se i inställningarna för att slå på."
            : "Få uppdateringar (biljettköp, avbokningar, väntelista) direkt – även när appen är stängd."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy || denied}
        onClick={on ? disable : enable}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-[var(--usha-gold)]" : "bg-[var(--usha-border)]"
        } ${busy || denied ? "opacity-50" : ""}`}
      >
        {busy ? (
          <Loader2 size={14} className="mx-auto animate-spin text-white" />
        ) : (
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        )}
      </button>
    </div>
  );
}
