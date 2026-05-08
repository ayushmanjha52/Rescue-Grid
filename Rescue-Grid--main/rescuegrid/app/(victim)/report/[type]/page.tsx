"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const SITUATION_LABELS: Record<string, string> = {
  food: "Food / भोजन",
  water: "Water / पानी",
  medical: "Medical / चिकित्सा",
  rescue: "Rescue / बचाव",
  shelter: "Shelter / आश्रय",
  missing: "Missing / लापता",
};

const SITUATION_PLACEHOLDERS: Record<string, string> = {
  food: "e.g., 10 food packets needed for families",
  water: "e.g., 5 gallons of drinking water required",
  medical: "e.g., 3 people need first aid / medicines",
  rescue: "e.g., 6 people stuck on roof, water rising",
  shelter: "e.g., 4 families need temporary shelter",
  missing: "e.g., 1 child missing near riverbank",
};

// Default location (India center)
const DEFAULT_LOCATION = { lng: 78.9629, lat: 20.5937, zoom: 4 };

export default function ReportTypePage() {
  const router = useRouter();
  const params = useParams();
  const type = (params.type as string) || "rescue";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapInitializedRef = useRef(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [peopleCount, setPeopleCount] = useState("");
  const [message, setMessage] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  // Location search with autocomplete
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const reverseGeocode = async (lng: number, lat: number) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,district,region,locality,neighborhood`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const place = data.features[0];
        const district =
          place.context?.find((c: { id: string }) => c.id.startsWith("district"))?.text || "";
        const city = place.text || "";
        const locationName = district ? `${city}, ${district}` : city;
        setPlaceName(locationName);
        setLocationQuery(locationName);
      }
    } catch {
      setPlaceName("Location selected");
    }
  };

  // Fetch location suggestions from Mapbox
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    try {
      // Bias search to India (approximate bbox)
      const indiaBbox = "68.0,6.0,97.0,37.0";
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&bbox=${indiaBbox}&types=place,district,region,locality,neighborhood,address`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationQuery && locationQuery !== placeName) {
        fetchSuggestions(locationQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [locationQuery, fetchSuggestions, placeName]);

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

  const handleSelectSuggestion = (place: any) => {
    const newLng = place.center[0];
    const newLat = place.center[1];
    setLocationQuery(place.place_name);
    setPlaceName(place.place_name);
    setLng(newLng);
    setLat(newLat);
    setAccuracy(null);
    setShowSuggestions(false);
    setSuggestions([]);

    // Update map
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [newLng, newLat], zoom: 14 });
      if (markerRef.current) {
        markerRef.current.setLngLat([newLng, newLat]);
      } else {
        const marker = new mapboxgl.Marker({ color: "#FF6B2B", draggable: true })
          .setLngLat([newLng, newLat])
          .addTo(mapRef.current);
        marker.on("dragend", () => {
          const m = marker.getLngLat();
          setLng(m.lng);
          setLat(m.lat);
          reverseGeocode(m.lng, m.lat);
        });
        markerRef.current = marker;
      }
    }
  };

  const initMap = (lng: number, lat: number, zoom: number = 14) => {
    if (!mapContainerRef.current || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: zoom,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      mapRef.current = map;

      // Only add marker if we have a specific location
      if (lat !== DEFAULT_LOCATION.lat || lng !== DEFAULT_LOCATION.lng) {
        const marker = new mapboxgl.Marker({ color: "#FF6B2B", draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);

        marker.on("dragend", () => {
          const m = marker.getLngLat();
          setLng(m.lng);
          setLat(m.lat);
          reverseGeocode(m.lng, m.lat);
        });

        markerRef.current = marker;
      }
    });

    map.on("click", (e) => {
      const newLng = e.lngLat.lng;
      const newLat = e.lngLat.lat;
      setLng(newLng);
      setLat(newLat);
      if (markerRef.current) {
        markerRef.current.setLngLat([newLng, newLat]);
      } else {
        const marker = new mapboxgl.Marker({ color: "#FF6B2B", draggable: true })
          .setLngLat([newLng, newLat])
          .addTo(map);
        marker.on("dragend", () => {
          const m = marker.getLngLat();
          setLng(m.lng);
          setLat(m.lat);
          reverseGeocode(m.lng, m.lat);
        });
        markerRef.current = marker;
      }
      reverseGeocode(newLng, newLat);
    });
  };

  const updateMapLocation = (lng: number, lat: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else if (mapRef.current) {
      const marker = new mapboxgl.Marker({ color: "#FF6B2B", draggable: true })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
      marker.on("dragend", () => {
        const m = marker.getLngLat();
        setLng(m.lng);
        setLat(m.lat);
        reverseGeocode(m.lng, m.lat);
      });
      markerRef.current = marker;
    }
    setLng(lng);
    setLat(lat);
    reverseGeocode(lng, lat);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported. Please type your location below.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, accuracy: acc } = pos.coords;
        setAccuracy(acc);
        setLocating(false);
        if (mapInitializedRef.current) {
          updateMapLocation(longitude, latitude);
        } else {
          setLng(longitude);
          setLat(latitude);
          reverseGeocode(longitude, latitude);
          setTimeout(() => initMap(longitude, latitude), 100);
        }
      },
      (err) => {
        let errorMsg = "Could not get GPS location. Please type your location below.";
        if (err.code === 1) {
          errorMsg = "GPS permission denied. Please type your location below.";
        } else if (err.code === 2) {
          errorMsg = "GPS unavailable. Please type your location below.";
        }
        setError(errorMsg);
        setLocating(false);
      },
      {
        enableHighAccuracy: false, // Faster response
        timeout: 8000,
        maximumAge: 60000, // Allow cached location
      }
    );
  };

  // Initialize map with default location immediately (don't wait for GPS)
  useEffect(() => {
    // Try to get cached/cached location first for faster startup
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude, latitude } = pos.coords;
          setLng(longitude);
          setLat(latitude);
          reverseGeocode(longitude, latitude);
          initMap(longitude, latitude, 14);
        },
        () => {
          // Fallback to default location
          initMap(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.zoom);
        },
        {
          enableHighAccuracy: false,
          timeout: 3000, // Quick timeout - if it takes too long, use default
          maximumAge: 300000, // Accept 5 min old cached location
        }
      );
    } else {
      initMap(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.zoom);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapInitializedRef.current = false;
        markerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setError("Phone number required");
      return;
    }
    if (!lat || !lng) {
      setError("Location required — tap the map or use current location");
      return;
    }
    setLoading(true);
    setError("");

    let fullMessage = message.trim();
    if (peopleCount.trim()) {
      const count = parseInt(peopleCount) || 0;
      if (count > 0) {
        fullMessage = `${count} people affected. ${fullMessage}`.trim();
      }
    }

    try {
      const res = await fetch("/api/victim/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_no: phone,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          situation: type,
          custom_message: fullMessage || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      const data = await res.json();
      router.push(`/report/status/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send report");
      setLoading(false);
    }
  };

  const situationLabel = SITUATION_LABELS[type] || type;
  const placeholder = SITUATION_PLACEHOLDERS[type] || "Describe the emergency...";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          onClick={() => router.push("/")}
          className="text-gray-400 hover:text-orange transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-display text-lg font-semibold text-gray-900 uppercase tracking-wide">
          {situationLabel}
        </span>
      </div>

      <div className="flex-1 px-4 pt-4 pb-24 space-y-4">
        {/* Location Search with Autocomplete */}
        <div ref={suggestionsRef} className="relative">
          <label className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            Location *
          </label>
          <div className="relative">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Type your location (e.g., Mumbai, Delhi...)"
              className="w-full px-3 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            )}
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg max-h-[200px] overflow-y-auto">
              {suggestions.map((place, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSuggestion(place)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <p className="font-body text-sm text-gray-900">{place.place_name}</p>
                  <p className="font-mono text-[10px] text-gray-400">
                    {place.place_type?.[0] || "Location"}
                  </p>
                </button>
              ))}
            </div>
          )}

          <p className="font-mono text-[10px] text-gray-400 mt-1">
            {lat && lng
              ? `📍 ${placeName || "Location selected"}`
              : "Search your location or use GPS below"}
          </p>
        </div>

        {/* Map */}
        <div>
          <div
            ref={mapContainerRef}
            className="w-full h-[160px] rounded overflow-hidden border border-gray-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-[10px] text-gray-400">
              {locating
                ? "Getting GPS location..."
                : "Tap map to adjust location"}
            </p>
            <button
              onClick={requestLocation}
              disabled={locating}
              className="flex items-center gap-1 font-mono text-[10px] text-orange uppercase tracking-[0.1em] hover:text-orange-600 transition-colors disabled:opacity-50"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={locating ? "animate-spin" : ""}
              >
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
              {locating ? "Locating..." : "Use GPS"}
            </button>
          </div>
          {error && (
            <p className="font-mono text-[10px] text-amber-600 mt-1">{error}</p>
          )}
        </div>

        <div>
          <label className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            People Affected *
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={peopleCount}
            onChange={(e) => setPeopleCount(e.target.value)}
            placeholder="e.g., 5"
            className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
          />
          <p className="font-mono text-[10px] text-gray-400 mt-1">How many people need {type}?</p>
        </div>

        <div>
          <label className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            Phone Number *
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 XXXXXXXXXX"
            className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
          />
        </div>

        <div>
          <label className="font-mono text-xs text-orange uppercase tracking-[0.2em] block mb-1.5">
            Additional Details (optional)
          </label>
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              placeholder={placeholder}
              rows={3}
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-body text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors resize-none"
            />
            <span className="absolute bottom-2 right-2 font-mono text-[10px] text-gray-400">
              {message.length}/280
            </span>
          </div>
        </div>

        {error && (
          <p className="text-red-500 font-mono text-xs">{error}</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={!phone.trim() || !lat || loading}
          className="w-full text-center font-display font-semibold text-base uppercase tracking-[0.15em] text-white bg-orange py-3.5 px-6 transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
