"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
// Types only: the ~1 MB map library is loaded in the background after the
// form is usable, so people can report without waiting for the map.
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, STORAGE_KEYS } from "@/lib/config";
import type { Situation } from "@/lib/status";
import { useStoredValue, writeStoredValue } from "@/hooks/useStoredValue";
import { rememberReport } from "@/lib/myReportsStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildSOSMessage, openSMSComposer, rememberLocation } from "@/components/victim/SOSSMSButton";

const SITUATION_LABELS: Record<Situation, string> = {
  food: "Food / भोजन",
  water: "Water / पानी",
  medical: "Medical / चिकित्सा",
  rescue: "Rescue / बचाव",
  shelter: "Shelter / आश्रय",
  missing: "Missing / लापता",
};

const SITUATION_PLACEHOLDERS: Record<Situation, string> = {
  food: "e.g., 10 food packets needed for families",
  water: "e.g., 5 gallons of drinking water required",
  medical: "e.g., 3 people need first aid / medicines",
  rescue: "e.g., 6 people stuck on roof, water rising",
  shelter: "e.g., 4 families need temporary shelter",
  missing: "e.g., 1 child missing near riverbank",
};

// Default view (India) until we know where the user is.
const DEFAULT_LOCATION = { lng: 78.9629, lat: 20.5937, zoom: 4 };
const MAX_DETAILS = 280;

interface GeocodeFeature {
  id: string;
  place_name: string;
  place_type?: string[];
  center: [number, number];
}

async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,district,region,locality,neighborhood`
    );
    const data = await res.json();
    const place = data.features?.[0];
    if (!place) return null;
    const district = place.context?.find((c: { id: string }) => c.id.startsWith("district"))?.text || "";
    const city = place.text || "";
    return district ? `${city}, ${district}` : city;
  } catch {
    return null;
  }
}

export default function ReportForm({ type }: { type: Situation }) {
  const router = useRouter();
  const isOnline = useOnlineStatus();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  // Last chosen point, so the map can show it if it finishes loading later.
  const pickedRef = useRef<{ lng: number; lat: number } | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [storedPhone] = useStoredValue(STORAGE_KEYS.victimPhone);
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const phone = phoneInput ?? storedPhone ?? "";

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState("");
  const [message, setMessage] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showSmsFallback, setShowSmsFallback] = useState(false);

  // Location search with autocomplete
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const userTypedRef = useRef(false);

  /** Moves (or creates) the draggable marker, if the map has loaded. */
  const placeMarker = useCallback((lngValue: number, latValue: number, fly: boolean) => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapbox) return;
    if (fly) map.flyTo({ center: [lngValue, latValue], zoom: 14 });
    if (markerRef.current) {
      markerRef.current.setLngLat([lngValue, latValue]);
      return;
    }
    const marker = new mapbox.Marker({ color: "#C44A12", draggable: true }).setLngLat([lngValue, latValue]).addTo(map);
    marker.on("dragend", () => {
      const m = marker.getLngLat();
      void selectLocationRef.current?.(m.lng, m.lat, { fly: false });
    });
    markerRef.current = marker;
  }, []);

  const selectLocationRef = useRef<
    ((lng: number, lat: number, options?: { accuracy?: number | null; label?: string; fly?: boolean }) => Promise<void>) | null
  >(null);

  /** Sets the chosen location, moves the map + marker and looks up a readable name. */
  const selectLocation = useCallback(
    async (newLng: number, newLat: number, options: { accuracy?: number | null; label?: string; fly?: boolean } = {}) => {
      setLng(newLng);
      setLat(newLat);
      setAccuracy(options.accuracy ?? null);
      setLocationError("");
      pickedRef.current = { lng: newLng, lat: newLat };
      placeMarker(newLng, newLat, options.fly !== false);

      if (options.label) {
        userTypedRef.current = false;
        setPlaceName(options.label);
        setLocationQuery(options.label);
        return;
      }
      const name = (await reverseGeocode(newLng, newLat)) || "Location selected";
      userTypedRef.current = false;
      setPlaceName(name);
      setLocationQuery(name);
    },
    [placeMarker]
  );

  useLayoutEffect(() => {
    selectLocationRef.current = selectLocation;
  });

  // Ask for the position straight away, without waiting for the map.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pickedRef.current) return; // the user already chose a place
        rememberLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        void selectLocation(pos.coords.longitude, pos.coords.latitude, { accuracy: pos.coords.accuracy });
      },
      () => {
        // Silent — the user can search, tap the map or use the GPS button.
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, [selectLocation]);

  // Load the map library in the background, then create the map.
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return;
    let cancelled = false;
    let map: mapboxgl.Map | null = null;

    void import("mapbox-gl").then(({ default: mapbox }) => {
      if (cancelled || !mapContainerRef.current) return;
      mapboxRef.current = mapbox;
      mapbox.accessToken = MAPBOX_TOKEN;
      const start = pickedRef.current;
      map = new mapbox.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: start ? [start.lng, start.lat] : [DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat],
        zoom: start ? 14 : DEFAULT_LOCATION.zoom,
      });
      map.addControl(new mapbox.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (e) => void selectLocationRef.current?.(e.lngLat.lng, e.lngLat.lat, { fly: false }));
      mapRef.current = map;
      // A location picked while the map was loading (GPS, search) gets its marker now.
      if (start) placeMarker(start.lng, start.lat, false);
    });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [placeMarker]);

  // Debounced autocomplete, only for text the user typed.
  useEffect(() => {
    if (!userTypedRef.current || !MAPBOX_TOKEN) return;
    const query = locationQuery.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const indiaBbox = "68.0,6.0,97.0,37.0";
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&bbox=${indiaBbox}&types=place,district,region,locality,neighborhood,address,poi`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch {
        // aborted or offline
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (place: GeocodeFeature) => {
    setShowSuggestions(false);
    setSuggestions([]);
    void selectLocation(place.center[0], place.center[1], { label: place.place_name });
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("GPS is not supported on this device. Please type your location above.");
      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { longitude, latitude, accuracy: acc } = pos.coords;
        rememberLocation({ latitude, longitude, accuracy: acc });
        void selectLocation(longitude, latitude, { accuracy: acc });
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === 1
            ? "GPS permission denied. Please type your location above."
            : "Could not get GPS location. Please type your location above or tap the map."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const buildDetails = () => {
    const count = Number.parseInt(peopleCount, 10);
    const details = message.trim();
    return count > 0 ? `${count} people affected. ${details}`.trim() : details;
  };

  const sendViaSms = () => {
    const location = lat !== null && lng !== null ? { latitude: lat, longitude: lng, accuracy } : null;
    openSMSComposer(buildSOSMessage(phone.trim(), type, location, buildDetails()));
  };

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setSubmitError("Please enter a valid 10-digit phone number");
      return;
    }
    if (lat === null || lng === null) {
      setSubmitError("Location required — search, tap the map, or use GPS");
      return;
    }

    writeStoredValue(STORAGE_KEYS.victimPhone, phone.trim());

    if (!navigator.onLine) {
      setShowSmsFallback(true);
      setSubmitError("You're offline. Send your report by SMS instead.");
      return;
    }

    setLoading(true);
    setSubmitError("");
    setShowSmsFallback(false);

    try {
      const res = await fetch("/api/victim/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_no: phone.trim(),
          latitude: lat,
          longitude: lng,
          accuracy,
          situation: type,
          custom_message: buildDetails() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }
      rememberReport(data.id);
      router.push(`/report/status/${data.id}`);
    } catch (err) {
      setShowSmsFallback(true);
      setSubmitError(
        err instanceof TypeError
          ? "Network error — your report was not sent. Send it by SMS instead."
          : err instanceof Error
            ? err.message
            : "Failed to send report"
      );
      setLoading(false);
    }
  };

  const hasLocation = lat !== null && lng !== null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          onClick={() => router.push("/")}
          className="text-gray-500 hover:text-orange transition-colors"
          aria-label="Back to home"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display text-lg font-semibold text-gray-900 uppercase tracking-wide">
          {SITUATION_LABELS[type]}
        </h1>
      </div>

      {!isOnline && (
        <div className="mx-4 mt-3 p-3 bg-orange-50 border border-orange-100 rounded-sm" role="status">
          <p className="font-mono text-[11px] text-orange-700">
            📡 You are offline. Fill in the form and send it by SMS — no internet needed.
          </p>
        </div>
      )}

      <div className="flex-1 px-4 pt-4 pb-32 space-y-4">
        {/* Location Search with Autocomplete */}
        <div ref={suggestionsRef} className="relative">
          <label htmlFor="report-location" className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            Location *
          </label>
          <div className="relative">
            <input
              id="report-location"
              type="text"
              value={locationQuery}
              onChange={(e) => {
                userTypedRef.current = true;
                setLocationQuery(e.target.value);
                if (e.target.value.trim().length < 2) {
                  setSuggestions([]);
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Type your village, area or landmark..."
              autoComplete="off"
              className="w-full px-3 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg max-h-[200px] overflow-y-auto">
              {suggestions.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(place)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <p className="font-body text-sm text-gray-900">{place.place_name}</p>
                  <p className="font-mono text-[10px] text-gray-500">
                    {place.place_type?.[0] || "Location"}
                  </p>
                </button>
              ))}
            </div>
          )}

          <p className="font-mono text-[10px] text-gray-500 mt-1">
            {hasLocation
              ? `📍 ${placeName || "Location selected"}${accuracy ? ` (±${Math.round(accuracy)}m)` : ""}`
              : "Search your location, tap the map, or use GPS below"}
          </p>
        </div>

        {/* Map */}
        <div>
          <div
            ref={mapContainerRef}
            className="w-full h-[180px] rounded overflow-hidden border border-gray-200 bg-gray-100"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-[10px] text-gray-500">
              {locating ? "Getting GPS location..." : "Tap the map or drag the pin to adjust"}
            </p>
            <button
              type="button"
              onClick={requestLocation}
              disabled={locating}
              className="flex items-center gap-1 font-mono text-[10px] text-orange uppercase tracking-[0.1em] hover:text-orange/80 transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={locating ? "animate-spin" : ""}>
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
              {locating ? "Locating..." : "Use GPS"}
            </button>
          </div>
          {locationError && (
            <p className="font-mono text-[10px] text-amber-700 mt-1" role="alert">{locationError}</p>
          )}
        </div>

        <div>
          <label htmlFor="report-people" className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            People Affected
          </label>
          <input
            id="report-people"
            type="number"
            inputMode="numeric"
            min="1"
            value={peopleCount}
            onChange={(e) => setPeopleCount(e.target.value)}
            placeholder="e.g., 5"
            className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
          />
          <p className="font-mono text-[10px] text-gray-500 mt-1">How many people need {type}?</p>
        </div>

        <div>
          <label htmlFor="report-phone" className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            Phone Number *
          </label>
          <input
            id="report-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+91 XXXXXXXXXX"
            className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
          />
          <p className="font-mono text-[10px] text-gray-500 mt-1">The rescue team will call this number</p>
        </div>

        <div>
          <label htmlFor="report-details" className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            Additional Details (optional)
          </label>
          <div className="relative">
            <textarea
              id="report-details"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_DETAILS))}
              placeholder={SITUATION_PLACEHOLDERS[type]}
              rows={3}
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors resize-none"
            />
            <span className="absolute bottom-2 right-2 font-mono text-[10px] text-gray-500">
              {message.length}/{MAX_DETAILS}
            </span>
          </div>
        </div>

        {submitError && (
          <p className="text-red-600 font-mono text-xs" role="alert">{submitError}</p>
        )}

        <p className="font-body text-[12px] text-gray-600 leading-snug">
          Your phone number, location and message are shared only with the disaster-response team and the responders sent to
          help you. / आपका नंबर और लोकेशन केवल बचाव दल के साथ साझा किया जाता है।
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 space-y-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {showSmsFallback && (
          <button
            type="button"
            onClick={sendViaSms}
            className="w-full text-center font-display font-semibold text-base uppercase tracking-[0.15em] text-white bg-red-500 py-3 px-6 hover:bg-red-600 active:scale-[0.98] rounded-sm"
          >
            📱 SEND BY SMS INSTEAD
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!phone.trim() || !hasLocation || loading}
          className="w-full text-center font-display font-semibold text-base uppercase tracking-[0.15em] text-white bg-orange py-3.5 px-6 transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Sending...
            </>
          ) : (
            "SEND REPORT →"
          )}
        </button>
      </div>
    </div>
  );
}
