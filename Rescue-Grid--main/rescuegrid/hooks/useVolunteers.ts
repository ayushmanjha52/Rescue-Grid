'use client';

import { useState, useEffect, useCallback } from 'react';
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
  push_token: string | null;
}

interface UseVolunteersOptions {
  bbox?: string;
  zoom?: number;
}

export function useVolunteers(options?: UseVolunteersOptions) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVolunteers = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/api/volunteer/locations';
      if (options?.bbox) {
        const params = new URLSearchParams({ bbox: options.bbox });
        if (options.zoom !== undefined) params.set('zoom', options.zoom.toString());
        url = `/api/volunteer/map?${params.toString()}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch volunteers');
      const data = await res.json();
      const volunteerData = data.data || data;
      setVolunteers(Array.isArray(volunteerData) ? volunteerData : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options?.bbox, options?.zoom]);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  useRealtimeSubscription<Volunteer>([
    {
      table: 'volunteer',
      onInsert: (newVol) => {
        setVolunteers((prev) => [...prev, newVol]);
      },
      onUpdate: (updatedVol) => {
        setVolunteers((prev) =>
          prev.map((v) => (v.id === updatedVol.id ? updatedVol : v))
        );
      },
      onDelete: (deletedVol) => {
        setVolunteers((prev) => prev.filter((v) => v.id !== deletedVol.id));
      },
    },
  ]);

  return { volunteers, loading, error, refresh: fetchVolunteers };
}
