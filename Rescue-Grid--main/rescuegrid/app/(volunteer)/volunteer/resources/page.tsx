"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MyResourceCard from "@/components/volunteer/resources/MyResourceCard";
import TFSharedResources from "@/components/volunteer/resources/TFSharedResources";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ResourceAllocation {
  id: string;
  resource?: { name: string; type: string; unit: string; location?: string };
  assignment?: { task: string };
  task_force?: { name: string };
  quantity_allocated: number;
  quantity_consumed: number;
  quantity_returned: number;
  status: string;
  notes: string | null;
  allocated_at: string;
}

const STATUS_ORDER: Record<string, number> = { allocated: 0, in_use: 1, consumed: 2, returned: 3, lost: 4 };

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    allocated: "bg-ops/20 text-ops",
    in_use: "bg-orange/20 text-orange",
    consumed: "bg-dim/20 text-dim",
    returned: "bg-caution/20 text-caution",
    lost: "bg-alert/20 text-alert",
  };
  return (
    <span className={`px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${styles[status] || "bg-surface-3 text-dim"}`}>
      {status === "in_use" ? "IN USE" : status}
    </span>
  );
}

export default function VolunteerResourcesPage() {
  const [mine, setMine] = useState<ResourceAllocation[]>([]);
  const [taskForce, setTaskForce] = useState<ResourceAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadResources = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/resources");
      if (res.ok) {
        const data = await res.json();
        // Combine mine + history into one list sorted by status order
        const allMine = [
          ...(Array.isArray(data.mine) ? data.mine : []),
          ...(Array.isArray(data.history) ? data.history : []),
        ].sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
        setMine(allMine);
        setTaskForce(Array.isArray(data.taskForce) ? data.taskForce : []);
      }
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();

    // Real-time listener using Supabase directly — no RLS issue because
    // the server route (service key) already fetches all data on trigger
    const supabase = createClient();
    channelRef.current = supabase
      .channel("volunteer-resources-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_allocation" },
        () => {
          loadResources();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadResources]);

  const handleUpdateStatus = async (id: string, status: string, qty?: number) => {
    try {
      const body: Record<string, string | number> = { status };
      if (qty !== undefined) {
        if (status === "consumed") body.quantity_consumed = qty;
        if (status === "returned") body.quantity_returned = qty;
      }

      const res = await fetch(`/api/volunteer/resource/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        loadResources();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-dim text-[11px] uppercase">Loading resources...</p>
        </div>
      </div>
    );
  }

  const activeResources = mine.filter((a) => ["allocated", "in_use"].includes(a.status));
  const historyResources = mine.filter((a) => !["allocated", "in_use"].includes(a.status));

  const totalActive = activeResources.length + taskForce.length;

  return (
    <div className="min-h-screen bg-void pb-20">
      <div className="bg-surface-1 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-orange uppercase tracking-wider">
              MY RESOURCES
            </h1>
            <p className="font-mono text-[10px] text-muted mt-0.5">
              DHANBAD DISPATCH
            </p>
          </div>
          {totalActive > 0 && (
            <span className="font-mono text-[10px] text-ops bg-ops/10 border border-ops/30 px-2 py-1">
              {totalActive} ACTIVE
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Active allocations directly to this volunteer */}
        {activeResources.length > 0 && (
          <div>
            <h3 className="font-mono text-[10px] text-orange uppercase tracking-wider mb-3">
              ASSIGNED TO YOU
            </h3>
            <div className="space-y-3">
              {activeResources.map((allocation) => (
                <MyResourceCard
                  key={allocation.id}
                  allocation={allocation}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
            </div>
          </div>
        )}

        {/* Task force shared resources */}
        {taskForce.length > 0 && (
          <TFSharedResources allocations={taskForce} />
        )}

        {/* Empty state — but only when truly no data at all */}
        {totalActive === 0 && historyResources.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-surface-2 mx-auto mb-4 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              </svg>
            </div>
            <p className="font-mono text-dim text-sm uppercase tracking-wider">
              NO RESOURCES ASSIGNED
            </p>
            <p className="font-mono text-dim text-xs mt-2">
              Resources allocated to you will appear here
            </p>
          </div>
        )}

        {/* History — consumed / returned / lost */}
        {historyResources.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between border-t border-border-dim pt-3"
            >
              <h3 className="font-mono text-[10px] text-orange uppercase tracking-wider">
                HISTORY ({historyResources.length})
              </h3>
              <span className="font-mono text-[10px] text-dim">
                {showHistory ? "▲ HIDE" : "▼ SHOW"}
              </span>
            </button>

            {showHistory && (
              <div className="space-y-2 mt-3">
                {historyResources.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="bg-surface-2 p-3 border border-border-dim opacity-70"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-display font-semibold text-ink uppercase text-sm">
                          {allocation.resource?.name || "Resource"}
                        </h4>
                        <p className="font-mono text-[10px] text-muted">
                          {allocation.quantity_allocated} {allocation.resource?.unit || "units"}
                          {allocation.notes && ` · ${allocation.notes}`}
                        </p>
                      </div>
                      <StatusPill status={allocation.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
