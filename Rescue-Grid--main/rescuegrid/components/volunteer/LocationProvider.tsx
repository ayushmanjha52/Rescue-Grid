'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

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

const UI_UPDATE_INTERVAL = 5000;
const DB_SYNC_THROTTLE = 30000;
const MIN_ACCEPTABLE_ACCURACY = 500; // meters - wait until we get at least this accuracy (mobile-friendly)
const GPS_TIMEOUT = 30000; // 30 seconds max wait for GPS

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const positionRef = useRef<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const uiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gpsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDbSyncRef = useRef<number>(0);
  const hasInitializedRef = useRef(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'acquired' | 'poor' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const sendLocationUpdate = useCallback(async (lat: number, lng: number, acc: number) => {
    const now = Date.now();
    if (now - lastDbSyncRef.current < DB_SYNC_THROTTLE) {
      return;
    }

    try {
      const res = await fetch('/api/volunteer/location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, accuracy: acc }),
      });

      if (res.ok) {
        lastDbSyncRef.current = now;
      }
    } catch {
      // Silent fail - will retry on next interval
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (uiIntervalRef.current) {
      clearInterval(uiIntervalRef.current);
      uiIntervalRef.current = null;
    }
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startContinuousTracking = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;

    setIsTracking(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        positionRef.current = { lat, lng, accuracy: acc, timestamp: Date.now() };
      },
      (err) => {
        if (err.code === 1) {
          setPermission('denied');
          stopTracking();
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // Don't use cached positions
      }
    );

    uiIntervalRef.current = setInterval(() => {
      const pos = positionRef.current;
      if (pos) {
        setLatitude(pos.lat);
        setLongitude(pos.lng);
        setAccuracy(pos.accuracy);
        sendLocationUpdate(pos.lat, pos.lng, pos.accuracy);
      }
    }, UI_UPDATE_INTERVAL);
  }, [sendLocationUpdate, stopTracking]);

  // Get initial position
  const getInitialPosition = useCallback((onSuccess: () => void) => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setPermission('denied');
      return;
    }

    setGpsStatus('searching');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        
        positionRef.current = { lat, lng, accuracy: acc, timestamp: Date.now() };
        setLatitude(lat);
        setLongitude(lng);
        setAccuracy(acc);
        setPermission('granted');
        setGpsStatus('acquired');
        setError(null);
        onSuccess();
      },
      (err) => {
        if (err.code === 1) {
          setPermission('denied');
          setGpsStatus(null);
          setError('Permission denied. Please enable location access in browser settings.');
        } else if (err.code === 2) {
          setGpsStatus(null);
          setError('GPS unavailable. Please enable location services.');
        } else {
          setGpsStatus(null);
          setError('Location request timed out. Try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  const requestPermission = useCallback(async () => {
    getInitialPosition(() => {
      startContinuousTracking();
    });
  }, [getInitialPosition, startContinuousTracking]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    getInitialPosition(() => {
      startContinuousTracking();
    });

    return () => {
      stopTracking();
    };
  }, [getInitialPosition, startContinuousTracking, stopTracking]);

  return (
    <LocationContext.Provider
      value={{
        latitude,
        longitude,
        accuracy,
        permission,
        error,
        gpsStatus,
        requestPermission,
        isTracking,
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
