"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client component that auto-detects user's city and redirects
 * to add location filter if none is set. Uses cookie to remember.
 */
export function GeoLocationDetector({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Skip if location filter already set
    if (searchParams.get("location")) return;

    // Check cookie first
    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith("usha_city="))
      ?.split("=")[1];

    if (saved) {
      applyCity(decodeURIComponent(saved));
      return;
    }

    // Try browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            // Reverse geocode with free Nominatim API
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=sv`
            );
            const data = await res.json();
            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.municipality ||
              data.address?.village;
            if (city) {
              saveCity(city);
              applyCity(city);
            }
          } catch {}
        },
        () => {
          // Geolocation denied — try IP-based fallback
          ipFallback();
        },
        { timeout: 5000 }
      );
    } else {
      ipFallback();
    }

    async function ipFallback() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.city) {
          saveCity(data.city);
          applyCity(data.city);
        }
      } catch {}
    }

    function saveCity(city: string) {
      document.cookie = `usha_city=${encodeURIComponent(city)};path=/;max-age=${60 * 60 * 24 * 30}`;
    }

    function applyCity(city: string) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("location", city.toLowerCase());
      router.replace(`${basePath}?${params.toString()}`, { scroll: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
