'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';

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

export function useTaskForceMemberLocations() {
  const [members, setMembers] = useState<TaskForceMemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dma/taskforce/member-locations');
      if (!res.ok) throw new Error('Failed to fetch task force member locations');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Subscribe to realtime updates for both task_force_member and volunteer tables
  useRealtimeSubscription<TaskForceMemberLocation>([
    {
      table: 'task_force_member',
      onInsert: () => fetchMembers(),
      onUpdate: () => fetchMembers(),
      onDelete: () => fetchMembers(),
    },
    {
      table: 'volunteer',
      onInsert: (newVol) => {
        // Only refetch if this volunteer might be a task force member
        if (newVol.latitude && newVol.longitude) {
          fetchMembers();
        }
      },
      onUpdate: (updatedVol) => {
        setMembers((prev) => {
          const index = prev.findIndex(m => m.id === updatedVol.id);
          if (index !== -1) {
            // Update existing member
            return prev.map(m => m.id === updatedVol.id ? { ...m, ...updatedVol } : m);
          }
          // If volunteer now has location and might be a new member, refetch
          if (updatedVol.latitude && updatedVol.longitude) {
            fetchMembers();
          }
          return prev;
        });
      },
      onDelete: (deletedVol) => {
        setMembers((prev) => prev.filter(m => m.id !== deletedVol.id));
      },
    },
  ]);

  return { members, loading, error, refresh: fetchMembers };
}
