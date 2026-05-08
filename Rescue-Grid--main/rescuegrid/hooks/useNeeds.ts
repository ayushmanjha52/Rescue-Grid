'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';

export interface VictimReport {
  id: string;
  phone_no: string;
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  situation: string;
  custom_message: string | null;
  urgency: string;
  status: string;
  created_at: string;
}

export function useNeeds() {
  const [needs, setNeeds] = useState<VictimReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNeeds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/victim/reports');
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setNeeds(Array.isArray(data) ? data : (data.reports || []));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNeeds();
  }, [fetchNeeds]);

  useRealtimeSubscription<VictimReport>([
    {
      table: 'victim_report',
      onInsert: (newNeed) => {
        setNeeds((prev) => [newNeed, ...prev]);
      },
      onUpdate: (updatedNeed) => {
        setNeeds((prev) =>
          prev.map((n) => (n.id === updatedNeed.id ? updatedNeed : n))
        );
      },
      onDelete: (deletedNeed) => {
        setNeeds((prev) => prev.filter((n) => n.id !== deletedNeed.id));
      },
    },
  ]);

  return { needs, loading, error, refresh: fetchNeeds };
}
