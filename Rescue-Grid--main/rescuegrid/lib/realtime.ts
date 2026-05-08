'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type TableName = 'victim_report' | 'assignment' | 'volunteer' | 'message' | 'task_force' | 'task_force_member' | 'resource' | 'resource_allocation';

export interface RealtimeConfig<T> {
  table: TableName;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
}

export function useRealtimeSubscription<T = Record<string, unknown>>(
  configs: RealtimeConfig<T>[],
  deps: React.DependencyList = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current && supabaseRef.current) {
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    const supabase = supabaseRef.current;
    cleanup();

    if (configs.length === 0) return;

    const channelName = `realtime-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(channelName);

    configs.forEach((config) => {
      const { table, filter, onInsert, onUpdate, onDelete } = config;

      channel = channel.on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload.old as T);
          }
        }
      );
    });

    channel.subscribe();
    channelRef.current = channel;

    return cleanup;
  }, [cleanup, ...deps]);

  return { cleanup };
}
