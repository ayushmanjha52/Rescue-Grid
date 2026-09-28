'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

export interface Assignment {
  id: string;
  task: string;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  urgency: string;
  status: string;
  assigned_to_volunteer: string | null;
  assigned_to_taskforce: string | null;
  victim_report_id: string | null;
  timer: string | null;
  created_at: string;
  updated_at: string;
  task_force?: { id: string; name: string } | null;
  volunteer_name?: string | null;
  volunteer_phone?: string | null;
  taskforce_name?: string | null;
  last_update?: { content: string; sender_type: string; created_at: string } | null;
  assignee_name?: string;
  assignee_type?: string;
  victim_situation?: string | null;
}

/**
 * Assignments for either the logged-in volunteer (their pending queue) or the
 * DMA dashboard (everything). Any change to the table triggers a debounced
 * refetch so joined fields (names, task forces) stay correct.
 */
export function useAssignments(scope: 'volunteer' | 'dma', options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const endpoint = scope === 'volunteer' ? '/api/volunteer/assignment/queue' : '/api/dma/assignment/list';
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch assignments');
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (enabled) void fetchAssignments();
  }, [fetchAssignments, enabled]);

  const scheduleRefetch = useDebouncedCallback(() => void fetchAssignments(), 300);

  useRealtimeSubscription(
    enabled
      ? [
          {
            table: 'assignment',
            onInsert: scheduleRefetch,
            onUpdate: scheduleRefetch,
            onDelete: scheduleRefetch,
          },
        ]
      : [],
    scope
  );

  return { assignments, loading: enabled ? loading : false, error, refresh: fetchAssignments };
}
