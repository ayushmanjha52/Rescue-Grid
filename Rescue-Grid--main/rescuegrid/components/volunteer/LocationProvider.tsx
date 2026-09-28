'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useVolunteerSession } from '@/components/volunteer/VolunteerSessionProvider';

interface LocationContextType {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  permission: 'granted' | 'denied' | 'prompt' | null;
  error: string | null;
  gpsStatus: 'searching' | 'acquired' | 'poor' | null;
  requestPermission: () => Promise<void>;
  isTracking: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const UI_UPDATE_INTERVAL = 5000; // how often the UI re-renders with a new fix
const DB_SYNC_THROTTLE = 30000; // how often the position is pushed to the server
const POOR_ACCURACY_METERS = 500;

interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const latestFixRef = useRef<Fix | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastDbSyncRef = useRef(0);
  const hasFixRef = useRef(false);

  const [fix, setFix] = useState<Fix | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'acquired' | 'poor' | null>('searching');
  const [error, setError] = useState<string | null>(null);

  // Volunteers who switched themselves offline stop sharing their position.
  const { volunteer } = useVolunteerSession();
  const sharingRef = useRef(true);
  useLayoutEffect(() => {
    sharingRef.current = volunteer?.status !== 'offline';
  });

  const syncToServer = useCallback(async (current: Fix, force = false) => {
    if (!sharingRef.current) return;
    const now = Date.now();
    if (!force && now - lastDbSyncRef.current < DB_SYNC_THROTTLE) return;
    lastDbSyncRef.current = now;
    try {
      await fetch('/api/volunteer/location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: current.lat, longitude: current.lng, accuracy: current.accuracy }),
      });
    } catch {
      // Offline — the next fix will retry.
      lastDbSyncRef.current = 0;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next: Fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        latestFixRef.current = next;
        setPermission('granted');
        setError(null);
        setGpsStatus(next.accuracy > POOR_ACCURACY_METERS ? 'poor' : 'acquired');

        // Show and report the first fix right away; later fixes are batched.
        if (!hasFixRef.current) {
          hasFixRef.current = true;
          setFix(next);
          void syncToServer(next, true);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
          setGpsStatus(null);
          setError('Location permission denied. Enable location access in your browser settings.');
        } else if (!hasFixRef.current) {
          setGpsStatus(null);
          setError(err.code === err.POSITION_UNAVAILABLE
            ? 'GPS unavailable. Please enable location services.'
            : 'Location request timed out. Move to an open area and retry.');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  }, [syncToServer]);

  useEffect(() => {
    startWatching();

    const interval = setInterval(() => {
      const latest = latestFixRef.current;
      if (!latest) return;
      setFix((prev) =>
        prev && prev.lat === latest.lat && prev.lng === latest.lng && prev.accuracy === latest.accuracy ? prev : latest
      );
      void syncToServer(latest);
    }, UI_UPDATE_INTERVAL);

    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatching, syncToServer]);

  const requestPermission = useCallback(async () => {
    setError(null);
    setGpsStatus('searching');
    hasFixRef.current = false;
    startWatching();
  }, [startWatching]);

  return (
    <LocationContext.Provider
      value={{
        latitude: fix?.lat ?? null,
        longitude: fix?.lng ?? null,
        accuracy: fix?.accuracy ?? null,
        permission,
        error,
        gpsStatus,
        requestPermission,
        isTracking: permission !== 'denied' && gpsStatus !== null,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
