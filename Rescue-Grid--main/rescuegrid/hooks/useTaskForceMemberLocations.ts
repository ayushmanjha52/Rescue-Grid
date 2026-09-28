'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

export interface TaskForceMemberLocation {
  id: string;
  task_force_id: string;
  name: string;
  mobile_no: string;
  type: string;
  status: string;
  latitude: number;
  longitude: number;
  last_seen: string | null;
}

/** Locations of active task force members, for drawing team routes on the DMA map. */
export function useTaskForceMemberLocations() {
  const [members, setMembers] = useState<TaskForceMemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/dma/taskforce/member-locations', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch task force member locations');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch task force member locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const scheduleRefetch = useDebouncedCallback(() => void fetchMembers(), 500);

  useRealtimeSubscription<TaskForceMemberLocation>([
    {
      // Membership or task force status changed → reload the roster.
      table: 'task_force_member',
      onInsert: scheduleRefetch,
      onUpdate: scheduleRefetch,
      onDelete: scheduleRefetch,
    },
    {
      table: 'task_force',
      onUpdate: scheduleRefetch,
    },
    {
      // Position pings: only move members we already track (no refetch storm).
      table: 'volunteer',
      onUpdate: (updatedVol) => {
        setMembers((prev) =>
          prev.some((m) => m.id === updatedVol.id)
            ? prev.map((m) =>
                m.id === updatedVol.id
                  ? {
                      ...m,
                      latitude: updatedVol.latitude ?? m.latitude,
                      longitude: updatedVol.longitude ?? m.longitude,
                      status: updatedVol.status ?? m.status,
                      last_seen: updatedVol.last_seen ?? m.last_seen,
                    }
                  : m
              )
            : prev
        );
      },
    },
  ]);

  return { members, loading, error, refresh: fetchMembers };
}
