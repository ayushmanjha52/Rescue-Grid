'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export type TableName = 'victim_report' | 'assignment' | 'volunteer' | 'message' | 'task_force' | 'task_force_member' | 'resource' | 'resource_allocation';

export interface RealtimeConfig<T> {
  table: TableName;
  filter?: string;
  onInsert?: (payload: T) => void;
  /**
   * `old` is the previous row as Supabase sends it. On tables with Row Level
   * Security (all of ours) it only contains the primary key, so don't compare
   * old and new values.
   */
  onUpdate?: (payload: T, old: Partial<T>) => void;
  onDelete?: (payload: T) => void;
}

let channelCounter = 0;

/**
 * Subscribes to Postgres changes for the given tables. The channel is only
 * recreated when a table/filter changes (or `key` changes); handlers always
 * see the latest props without resubscribing.
 */
export function useRealtimeSubscription<T = Record<string, unknown>>(
  configs: RealtimeConfig<T>[],
  key = ''
) {
  const configsRef = useRef(configs);
  useLayoutEffect(() => {
    configsRef.current = configs;
  });

  const signature = `${configs.map((c) => `${c.table}:${c.filter ?? ''}`).join('|')}#${key}`;

  useEffect(() => {
    const initial = configsRef.current;
    if (initial.length === 0) return;

    const supabase = createClient();
    let channel = supabase.channel(`realtime-${++channelCounter}-${Date.now()}`);

    initial.forEach(({ table, filter }, index) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          const handlers = configsRef.current[index];
          if (!handlers) return;
          if (payload.eventType === 'INSERT') handlers.onInsert?.(payload.new as T);
          else if (payload.eventType === 'UPDATE') handlers.onUpdate?.(payload.new as T, payload.old as Partial<T>);
          else if (payload.eventType === 'DELETE') handlers.onDelete?.(payload.old as T);
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [signature]);
}
