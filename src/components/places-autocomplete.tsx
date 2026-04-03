"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  /** Hidden input names for lat/lng/placeId */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lat, setLat] = useState<number | null>(defaultLat);
  const [lng, setLng] = useState<number | null>(defaultLng);
  const [placeId, setPlaceId] = useState<string | null>(defaultPlaceId);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // Already loaded
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          setLoaded(true);
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=sv`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize autocomplete
  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment", "geocode"],
      componentRestrictions: { country: "se" },
      fields: ["formatted_address", "geometry", "place_id", "name"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const result: PlaceResult = {
        address: place.name
          ? `${place.name}, ${place.formatted_address}`
          : place.formatted_address || "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id || "",
      };

      // Update the input value with the formatted address
      if (inputRef.current) {
        inputRef.current.value = result.address;
      }
      setLat(result.lat);
      setLng(result.lng);
      setPlaceId(result.placeId);
      onPlaceSelect?.(result);
    });

    autocompleteRef.current = autocomplete;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (loaded) initAutocomplete();
  }, [loaded, initAutocomplete]);

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 flex items-center gap-1.5 text-sm text-[var(--usha-muted)]">
        <MapPin size={14} />
        Plats
      </label>
      <input
        ref={inputRef}
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
