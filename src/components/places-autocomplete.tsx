"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

interface PlacesAutocompleteProps {
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  onPlaceSelect?: (place: PlaceResult | null) => void;
  latName?: string;
  lngName?: string;
  placeIdName?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  defaultPlaceId?: string | null;
}

export default function PlacesAutocomplete({
  defaultValue = "",
  name = "event_location",
  placeholder = "t.ex. Kulturhuset, Stockholm",
  onPlaceSelect,
  latName = "event_lat",
  lngName = "event_lng",
  placeIdName = "event_place_id",
  defaultLat = null,
  defaultLng = null,
  defaultPlaceId = null,
}: PlacesAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const [lat, setLat] = useState<number | null>(defaultLat);
  const [lng, setLng] = useState<number | null>(defaultLng);
  const [placeId, setPlaceId] = useState<string | null>(defaultPlaceId);
  const [address, setAddress] = useState(defaultValue);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || initializedRef.current || !containerRef.current) return;

    async function init() {
      // Load Google Maps script if not already loaded
      if (!window.google?.maps) {
        await new Promise<void>((resolve, reject) => {
          if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            const check = setInterval(() => {
              if (window.google?.maps) {
                clearInterval(check);
                resolve();
              }
            }, 100);
            return;
          }
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=sv&loading=async`;
          script.async = true;
          script.onload = () => {
            const check = setInterval(() => {
              if (window.google?.maps) {
                clearInterval(check);
                resolve();
              }
            }, 50);
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Import the places library
      const { Place, AutocompleteSessionToken, AutocompleteSuggestion } =
        (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;

      initializedRef.current = true;

      // Build a custom autocomplete using the new API
      const input = containerRef.current?.querySelector("input");
      if (!input) return;

      let debounceTimer: ReturnType<typeof setTimeout>;

      input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchSuggestions(input.value), 300);
      });

      // Close dropdown on click outside
      document.addEventListener("click", (e) => {
        const dropdown = containerRef.current?.querySelector("[data-suggestions]");
        if (dropdown && !containerRef.current?.contains(e.target as Node)) {
          dropdown.remove();
        }
      });

      async function fetchSuggestions(query: string) {
        if (!query || query.length < 2) {
          removeSuggestions();
          return;
        }

        try {
          const token = new AutocompleteSessionToken();
          const request = {
            input: query,
            language: "sv",
            region: "se",
            sessionToken: token,
          };

          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

          showSuggestions(
            suggestions
              .filter((s) => s.placePrediction)
              .map((s) => ({
                text: s.placePrediction!.text.text,
                placeId: s.placePrediction!.placeId,
                description: s.placePrediction!.text.text,
              })),
            token
          );
        } catch {
          // Silently fail - user can still type manually
        }
      }

      function showSuggestions(
        items: { text: string; placeId: string; description: string }[],
        token: google.maps.places.AutocompleteSessionToken
      ) {
        removeSuggestions();
        if (!items.length || !containerRef.current) return;

        const dropdown = document.createElement("div");
        dropdown.setAttribute("data-suggestions", "");
        dropdown.className =
          "absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] shadow-xl";

        items.forEach((item) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className =
            "flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition hover:bg-white/5";
          option.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-[var(--usha-muted)]"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><span>${item.description}</span>`;

          option.addEventListener("click", async () => {
            const place = new Place({ id: item.placeId });
            await place.fetchFields({
              fields: ["displayName", "formattedAddress", "location", "id"],
            });

            const loc = place.location;
            const displayAddr = place.displayName
              ? `${place.displayName}, ${place.formattedAddress}`
              : place.formattedAddress || item.text;

            if (input) input.value = displayAddr || "";
            setAddress(displayAddr || "");
            setLat(loc?.lat() ?? null);
            setLng(loc?.lng() ?? null);
            setPlaceId(place.id || item.placeId);

            onPlaceSelect?.({
              address: displayAddr || "",
              lat: loc?.lat() ?? 0,
              lng: loc?.lng() ?? 0,
              placeId: place.id || item.placeId,
            });

            removeSuggestions();
          });

          dropdown.appendChild(option);
        });

        containerRef.current.appendChild(dropdown);
      }

      function removeSuggestions() {
        containerRef.current
          ?.querySelector("[data-suggestions]")
          ?.remove();
      }
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={name} className="mb-1.5 flex items-center gap-1.5 text-sm text-[var(--usha-muted)]">
        <MapPin size={14} />
        Plats
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
      />
      {/* Hidden fields for coordinates */}
      <input type="hidden" name={latName} value={lat ?? ""} />
      <input type="hidden" name={lngName} value={lng ?? ""} />
      <input type="hidden" name={placeIdName} value={placeId ?? ""} />
    </div>
  );
}
