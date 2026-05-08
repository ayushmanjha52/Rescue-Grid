'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { useLocation } from '@/components/volunteer/LocationProvider';

interface Assignment {
  id: string;
  task: string;
  location_label: string;
  latitude: number;
  longitude: number;
  urgency: string;
}

declare global {
  interface Window {
    mapboxgl: any;
  }
}

export default function VolunteerMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const volunteerMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxReady, setMapboxReady] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use the LocationProvider context instead of raw geolocation
  const { latitude: volLat, longitude: volLng, permission, requestPermission } = useLocation();

  // Fetch active assignment
  const fetchAssignment = useCallback(async () => {
    try {
      const res = await fetch('/api/volunteer/assignment/active');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          setAssignment(data);
        } else {
          setAssignment(null);
        }
      }
    } catch {
      setError('Failed to load assignment');
    }
  }, []);

  // Fetch driving route from Mapbox Directions API
  const fetchRoute = useCallback(async (fromLng: number, fromLat: number, toLng: number, toLat: number) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${token}&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const distanceKm = (route.distance / 1000).toFixed(1);
          const durationMin = Math.round(route.duration / 60);
          setRouteInfo({ distance: `${distanceKm} km`, duration: `~${durationMin} min` });

          if (map.current && map.current.getSource('route')) {
            (map.current.getSource('route') as any).setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            });
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  // Prompt for location if not granted
  useEffect(() => {
    if (permission === 'denied') {
      setError('Location access denied. Please enable GPS in browser settings.');
    } else if (permission === 'prompt') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Load Mapbox GL JS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError('Mapbox token not configured');
      return;
    }

    // Check if Mapbox is already loaded
    if (window.mapboxgl) {
      setMapboxReady(true);
      return;
    }

    // Load CSS
    if (!document.querySelector('link[href*="mapbox-gl"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => {
      setMapboxReady(true);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize map once Mapbox JS is loaded
  useEffect(() => {
    if (!mapboxReady || !mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    window.mapboxgl.accessToken = token;

    // Center on volunteer location if available, otherwise default
    const centerLng = volLng ?? 86.47;
    const centerLat = volLat ?? 23.65;

    map.current = new window.mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 13,
    });

    map.current.addControl(new window.mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      // Add route source and layer
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });
      map.current.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FF6B2B', 'line-width': 4, 'line-opacity': 0.8 },
      });

      setMapLoaded(true);
    });

    return () => {
      if (volunteerMarker.current) {
        volunteerMarker.current.remove();
        volunteerMarker.current = null;
      }
      if (destMarker.current) {
        destMarker.current.remove();
        destMarker.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setMapLoaded(false);
    };
  }, [mapboxReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update volunteer marker when location changes
  useEffect(() => {
    if (!mapLoaded || !map.current || volLat === null || volLng === null) return;

    if (volunteerMarker.current) {
      volunteerMarker.current.setLngLat([volLng, volLat]);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:20px;height:20px;background:#3B8BFF;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;

      volunteerMarker.current = new window.mapboxgl.Marker({ element: el })
        .setLngLat([volLng, volLat])
        .addTo(map.current);
    }
  }, [volLat, volLng, mapLoaded]);

  // Add destination marker + route when assignment loads
  useEffect(() => {
    if (!mapLoaded || !map.current || !assignment?.latitude || !assignment?.longitude) return;

    if (!destMarker.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:30px;height:30px;background:#FF6B2B;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;

      destMarker.current = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([assignment.longitude, assignment.latitude])
        .addTo(map.current);
    } else {
      destMarker.current.setLngLat([assignment.longitude, assignment.latitude]);
    }

    // Fit bounds if both locations available
    if (volLat !== null && volLng !== null) {
      fetchRoute(volLng, volLat, assignment.longitude, assignment.latitude);

      const bounds = new window.mapboxgl.LngLatBounds()
        .extend([volLng, volLat])
        .extend([assignment.longitude, assignment.latitude]);
      map.current.fitBounds(bounds, { padding: 80 });
    } else {
      // Just center on destination
      map.current.flyTo({ center: [assignment.longitude, assignment.latitude], zoom: 14 });
    }
  }, [mapLoaded, assignment, volLat, volLng, fetchRoute]);

  const openInGoogleMaps = () => {
    if (!assignment?.latitude || !assignment?.longitude) return;

    let url: string;
    if (volLat !== null && volLng !== null) {
      url = `https://www.google.com/maps/dir/${volLat},${volLng}/${assignment.latitude},${assignment.longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${assignment.latitude},${assignment.longitude}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="relative h-full">
      <div ref={mapContainer} className="w-full h-full min-h-[calc(100vh-180px)]" />

      {error && (
        <div className="absolute top-4 left-4 right-4 bg-surface-2 p-3" style={{ clipPath: 'var(--clip-tactical-sm)' }}>
          <p className="font-mono text-[11px] text-alert">{error}</p>
          {permission === 'denied' && (
            <button
              onClick={requestPermission}
              className="font-mono text-[10px] text-orange underline mt-1"
            >
              RETRY PERMISSION
            </button>
          )}
        </div>
      )}

      {assignment && (
        <div className="absolute bottom-0 left-0 right-0 bg-surface-1 border-t border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-display text-sm font-semibold text-ink uppercase">
                {assignment.location_label || 'Mission Location'}
              </p>
              {routeInfo && (
                <p className="font-mono text-[10px] text-muted">
                  {routeInfo.distance} &middot; {routeInfo.duration} driving
                </p>
              )}
              {!routeInfo && volLat === null && (
                <p className="font-mono text-[10px] text-caution">
                  Waiting for your location...
                </p>
              )}
            </div>
            <Button variant="ghost" size="small" onClick={openInGoogleMaps}>
              GOOGLE MAPS
            </Button>
          </div>
        </div>
      )}

      {!assignment && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-void/80">
          <div className="text-center">
            <p className="font-mono text-dim text-sm">NO ACTIVE MISSION</p>
            <p className="font-mono text-[10px] text-dim mt-1">Accept a mission to see the route</p>
          </div>
        </div>
      )}
    </div>
  );
}
