"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

interface LiveCounters {
  critical: number;
  active: number;
  vols: number;
}

interface CountersContextType {
  counters: LiveCounters;
  loading: boolean;
  refetch: () => void;
}

const CountersContext = createContext<CountersContextType | undefined>(undefined);

export function CountersProvider({ children }: { children: ReactNode }) {
  const [counters, setCounters] = useState<LiveCounters>({ critical: 0, active: 0, vols: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounters = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/counters", { cache: "no-store" });
      if (res.ok) {
        setCounters(await res.json());
      }
    } catch {
      // Silent fail - keep existing counters
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCounters();
  }, [fetchCounters]);

  // Volunteer GPS pings arrive constantly — coalesce them into one refetch.
  const scheduleRefetch = useDebouncedCallback(() => void fetchCounters(), 1000);

  // Last status seen per volunteer. Supabase sends only the primary key as the
  // "old" row on RLS tables, so status changes are detected against this map.
  const volunteerStatuses = useRef(new Map<string, string | undefined>());

  useRealtimeSubscription<{ id?: string; status?: string }>([
    { table: "victim_report", onInsert: scheduleRefetch, onUpdate: scheduleRefetch, onDelete: scheduleRefetch },
    { table: "assignment", onInsert: scheduleRefetch, onUpdate: scheduleRefetch, onDelete: scheduleRefetch },
    {
      table: "volunteer",
      onInsert: scheduleRefetch,
      onDelete: scheduleRefetch,
      // Only status changes affect the counter, not location updates.
      onUpdate: (row) => {
        if (!row.id) return;
        const known = volunteerStatuses.current;
        const changed = !known.has(row.id) || known.get(row.id) !== row.status;
        known.set(row.id, row.status);
        if (changed) scheduleRefetch();
      },
    },
  ]);

  const value = useMemo(() => ({ counters, loading, refetch: fetchCounters }), [counters, loading, fetchCounters]);

  return <CountersContext.Provider value={value}>{children}</CountersContext.Provider>;
}

export function useCounters() {
  const context = useContext(CountersContext);
  if (context === undefined) {
    throw new Error("useCounters must be used within a CountersProvider");
  }
  return context;
}
