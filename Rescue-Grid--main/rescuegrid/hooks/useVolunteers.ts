'use client';

import { useState, useEffect } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';

export interface Volunteer {
  id: string;
  name: string;
  mobile_no: string;
  type: string;
  latitude: number;
  longitude: number;
  skills: string | string[];
  equipment: string | string[];
  score?: number;
  status: string;
  tier?: number;
  last_seen: string | null;
}

interface UseVolunteersOptions {
  bbox?: string;
  zoom?: number;
}

const VISIBLE_STATUSES = ['active', 'standby', 'on-mission'];

/** Volunteers on the DMA map, scoped to the visible viewport and kept live. */
export function useVolunteers(options?: UseVolunteersOptions) {
  const bbox = options?.bbox;
  const zoom = options?.zoom;
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        let url = '/api/volunteer/locations';
        if (bbox) {
          const params = new URLSearchParams({ bbox });
          if (zoom !== undefined) params.set('zoom', zoom.toString());
          url = `/api/volunteer/map?${params.toString()}`;
        }
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch volunteers');
        const data = await res.json();
        const volunteerData = data.data || data;
        setVolunteers(Array.isArray(volunteerData) ? volunteerData : []);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch volunteers');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [bbox, zoom, reloadKey]);

  useRealtimeSubscription<Volunteer>([
    {
      table: 'volunteer',
      onInsert: (newVol) => {
        if (newVol.latitude == null || newVol.longitude == null || !VISIBLE_STATUSES.includes(newVol.status)) return;
        setVolunteers((prev) => (prev.some((v) => v.id === newVol.id) ? prev : [...prev, newVol]));
      },
      onUpdate: (updatedVol) => {
        setVolunteers((prev) => {
          if (!VISIBLE_STATUSES.includes(updatedVol.status)) {
            return prev.filter((v) => v.id !== updatedVol.id);
          }
          const existing = prev.find((v) => v.id === updatedVol.id);
          if (!existing) {
            return updatedVol.latitude != null && updatedVol.longitude != null ? [...prev, updatedVol] : prev;
          }
          // Keep the normalized skill list from the API; the raw row only has the text column.
          return prev.map((v) =>
            v.id === updatedVol.id ? { ...v, ...updatedVol, skills: Array.isArray(v.skills) ? v.skills : updatedVol.skills } : v
          );
        });
      },
      onDelete: (deletedVol) => {
        setVolunteers((prev) => prev.filter((v) => v.id !== deletedVol.id));
      },
    },
  ]);

  return { volunteers, loading, error, refresh: () => setReloadKey((k) => k + 1) };
}
