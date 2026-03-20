"use client";

import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set initial state from browser
    setIsOnline(navigator.onLine);

    let onlineTimer: ReturnType<typeof setTimeout>;

    function handleOnline() {
      setIsOnline(true);
      setShowOnline(true);
      // Clear any previous timer before setting a new one
      clearTimeout(onlineTimer);
      onlineTimer = setTimeout(() => setShowOnline(false), 3000);
    }

    function handleOffline() {
      setIsOnline(false);
      setShowOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(onlineTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) return null;

  // Offline banner — always visible when offline
  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-red-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
      >
        <span className="h-2 w-2 rounded-full bg-white" />
        Ingen internetanslutning
      </div>
    );
  }

  // Online banner — briefly shown after reconnecting
  if (showOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-green-600/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm animate-fade-in"
      >
        <span className="h-2 w-2 rounded-full bg-white" />
        Anslutning återupprättad
      </div>
    );
  }

  return null;
}
