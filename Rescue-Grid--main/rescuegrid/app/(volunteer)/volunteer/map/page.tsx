'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Button from '@/components/ui/Button';
import { useLocation } from '@/components/volunteer/LocationProvider';
import { DEFAULT_MAP_CENTER, MAPBOX_TOKEN } from '@/lib/config';
import { haversineKm } from '@/lib/geo';

interface Assignment {
  id: string;
  task: string;
  location_label: string | null;
  latitude: number;
  longitude: number;
  urgency: string;
}

// Re-route only after moving this far, to keep Directions API usage sane.
const REROUTE_DISTANCE_KM = 0.2;

async function fetchDrivingRoute(from: { lat: number; lng: number }, to: Assignment) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.longitude},${to.latitude}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;

  const minutes = Math.round(route.duration / 60);
  return {
    geometry: route.geometry as GeoJSON.LineString,
    info: {
      distance: `${(route.distance / 1000).toFixed(1)} km`,
      duration: minutes >= 60 ? `~${Math.floor(minutes / 60)}h ${minutes % 60}m` : `~${minutes} min`,
    },
  };
}

export default function VolunteerMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const volunteerMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const lastRouteOrigin = useRef<{ lat: number; lng: number; assignmentId: string } | null>(null);
  const fittedAssignment = useRef<string | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignmentLoaded, setAssignmentLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { latitude: volLat, longitude: volLng, permission, error: gpsError, requestPermission } = useLocation();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/volunteer/assignment/active', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setAssignment(data && data.latitude != null && data.longitude != null ? data : null);
        setAssignmentLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Failed to load assignment');
          setAssignmentLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat],
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });
      map.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FF6B2B', 'line-width': 5, 'line-opacity': 0.85 },
      });
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      volunteerMarker.current = null;
      destMarker.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  const showRoute = useCallback((from: { lat: number; lng: number }, to: Assignment) => {
    fetchDrivingRoute(from, to)
      .then((route) => {
        if (!route) return;
        setRouteInfo(route.info);
        (mapRef.current?.getSource('route') as mapboxgl.GeoJSONSource | undefined)?.setData({
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        });
      })
      .catch(() => {
        // offline — keep the last route
      });
  }, []);

  // Volunteer position marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map || volLat === null || volLng === null) return;

    if (volunteerMarker.current) {
      volunteerMarker.current.setLngLat([volLng, volLat]);
    } else {
      const el = document.createElement('div');
      el.style.cssText = 'width:20px;height:20px;background:#3B8BFF;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
      volunteerMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([volLng, volLat]).addTo(map);
      if (!assignment) map.flyTo({ center: [volLng, volLat], zoom: 14 });
    }
  }, [volLat, volLng, mapLoaded, assignment]);

  // Destination marker, one-time framing and throttled re-routing.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map || !assignment) return;

    if (destMarker.current) {
      destMarker.current.setLngLat([assignment.longitude, assignment.latitude]);
    } else {
      const el = document.createElement('div');
      el.style.cssText = 'width:30px;height:30px;background:#FF6B2B;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
      destMarker.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([assignment.longitude, assignment.latitude])
        .addTo(map);
    }

    const hasPosition = volLat !== null && volLng !== null;

    // Frame the trip once per mission so the map doesn't jump on every GPS tick.
    if (fittedAssignment.current !== assignment.id) {
      if (hasPosition) {
        map.fitBounds(
          new mapboxgl.LngLatBounds([volLng, volLat], [volLng, volLat]).extend([assignment.longitude, assignment.latitude]),
          { padding: 80, maxZoom: 15 }
        );
        fittedAssignment.current = assignment.id;
      } else {
        map.flyTo({ center: [assignment.longitude, assignment.latitude], zoom: 14 });
      }
    }

    if (!hasPosition) return;
    const last = lastRouteOrigin.current;
    const moved = !last || last.assignmentId !== assignment.id || haversineKm(last.lat, last.lng, volLat, volLng) > REROUTE_DISTANCE_KM;
    if (moved) {
      lastRouteOrigin.current = { lat: volLat, lng: volLng, assignmentId: assignment.id };
      showRoute({ lat: volLat, lng: volLng }, assignment);
    }
  }, [mapLoaded, assignment, volLat, volLng, showRoute]);

  const openInGoogleMaps = () => {
    if (!assignment) return;
    const url = volLat !== null && volLng !== null
      ? `https://www.google.com/maps/dir/${volLat},${volLng}/${assignment.latitude},${assignment.longitude}`
      : `https://www.google.com/maps/dir/?api=1&destination=${assignment.latitude},${assignment.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const error = !MAPBOX_TOKEN
    ? 'Map is not configured (missing NEXT_PUBLIC_MAPBOX_TOKEN).'
    : permission === 'denied'
      ? 'Location access denied. Please enable GPS in browser settings.'
      : loadError || gpsError;

  return (
    <div className="relative h-[calc(100dvh-108px)]">
      <div ref={mapContainer} className="w-full h-full bg-surface-2" />

      {error && (
        <div className="absolute top-4 left-4 right-14 bg-white/95 p-3 shadow clip-path-tactical-sm" role="alert">
          <p className="font-mono text-[11px] text-alert">{error}</p>
          {(permission === 'denied' || gpsError) && (
            <button onClick={requestPermission} className="font-mono text-[10px] text-orange underline mt-1">
              RETRY GPS
            </button>
          )}
        </div>
      )}

      {assignment && (
        <div className="absolute bottom-0 left-0 right-0 bg-surface-1 border-t border-border p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-ink uppercase truncate">
                {assignment.location_label || 'Mission Location'}
              </p>
              {routeInfo ? (
                <p className="font-mono text-[10px] text-muted">
                  {routeInfo.distance} &middot; {routeInfo.duration} driving
                </p>
              ) : volLat === null ? (
                <p className="font-mono text-[10px] text-caution">Waiting for your location...</p>
              ) : null}
            </div>
            <Button variant="ghost" size="small" onClick={openInGoogleMaps}>
              NAVIGATE ↗
            </Button>
          </div>
        </div>
      )}

      {assignmentLoaded && !assignment && !error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 px-4 py-2 shadow text-center">
          <p className="font-mono text-dim text-[11px]">NO ACTIVE MISSION</p>
          <p className="font-mono text-[10px] text-dim mt-0.5">Accept a mission to see the route</p>
        </div>
      )}
    </div>
  );
}
