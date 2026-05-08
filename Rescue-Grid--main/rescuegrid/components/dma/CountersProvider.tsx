"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [counters, setCounters] = useState<LiveCounters>({ critical: 0, active: 0, vols: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounters = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/counters");
      if (res.ok) {
        const data = await res.json();
        setCounters(data);
      }
    } catch {
      // Silent fail - keep existing counters
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    const supabase = supabaseRef.current;

    fetchCounters();

    channelRef.current = supabase
      .channel(`dma-counters-global`)
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'victim_report',
        },
        () => {
          fetchCounters();
        }
      )
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'assignment',
        },
        () => {
          fetchCounters();
        }
      )
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'volunteer',
        },
        () => {
          fetchCounters();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      }
    };
  }, [fetchCounters]);

  const refetch = useCallback(() => {
    fetchCounters();
  }, [fetchCounters]);

  return (
    <CountersContext.Provider value={{ counters, loading, refetch }}>
      {children}
    </CountersContext.Provider>
  );
}

export function useCounters() {
  const context = useContext(CountersContext);
  if (context === undefined) {
    throw new Error("useCounters must be used within a CountersProvider");
  }
  return context;
}
