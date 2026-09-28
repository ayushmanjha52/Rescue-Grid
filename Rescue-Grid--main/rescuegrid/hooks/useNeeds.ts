'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';

export interface VictimReport {
  id: string;
  phone_no: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
  situation: string;
  custom_message: string | null;
  urgency: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

/** Live list of victim reports for the DMA dashboard (newest first). */
export function useNeeds() {
  const [needs, setNeeds] = useState<VictimReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNeeds = useCallback(async () => {
    try {
      const res = await fetch('/api/victim/reports', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setNeeds(Array.isArray(data) ? data : (data.reports || []));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNeeds();
  }, [fetchNeeds]);

  useRealtimeSubscription<VictimReport>([
    {
      table: 'victim_report',
      onInsert: (newNeed) => {
        setNeeds((prev) => (prev.some((n) => n.id === newNeed.id) ? prev : [newNeed, ...prev]));
      },
      onUpdate: (updatedNeed) => {
        setNeeds((prev) => prev.map((n) => (n.id === updatedNeed.id ? { ...n, ...updatedNeed } : n)));
      },
      onDelete: (deletedNeed) => {
        setNeeds((prev) => prev.filter((n) => n.id !== deletedNeed.id));
      },
    },
  ]);

  return { needs, loading, error, refresh: fetchNeeds };
}
