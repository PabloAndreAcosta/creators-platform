"use client";

import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    // Set initial state from browser
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setShowOnline(true);
      // Hide "online" banner after 3 seconds
      const timer = setTimeout(() => setShowOnline(false), 3000);
      return () => clearTimeout(timer);
    }

    function handleOffline() {
      setIsOnline(false);
      setShowOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
