"use client";

import { useState, useEffect, useCallback } from "react";
import MyResourceCard, { type VolunteerAllocation } from "@/components/volunteer/resources/MyResourceCard";
import { createClient } from "@/lib/supabase/client";
import { useVolunteerSession } from "@/components/volunteer/VolunteerSessionProvider";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

const STATUS_STYLES: Record<string, string> = {
  allocated: "bg-ops/20 text-ops",
  in_use: "bg-orange/20 text-orange",
  consumed: "bg-dim/20 text-dim",
  returned: "bg-caution/20 text-caution",
  lost: "bg-alert/20 text-alert",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${STATUS_STYLES[status] || "bg-surface-3 text-dim"}`}>
      {status === "in_use" ? "IN USE" : status}
    </span>
  );
}

export default function VolunteerResourcesPage() {
  const { volunteer } = useVolunteerSession();
  const volunteerId = volunteer?.id;
  const [mine, setMine] = useState<VolunteerAllocation[]>([]);
  const [taskForce, setTaskForce] = useState<VolunteerAllocation[]>([]);
  const [history, setHistory] = useState<VolunteerAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const loadResources = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/resources", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMine(Array.isArray(data.mine) ? data.mine : []);
        setTaskForce(Array.isArray(data.taskForce) ? data.taskForce : []);
        setHistory(Array.isArray(data.history) ? data.history : []);
      }
    } catch {
      // offline — keep last data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const scheduleReload = useDebouncedCallback(() => void loadResources(), 300);

  useEffect(() => {
    if (!volunteerId) return;
    const supabase = createClient();
    // Unfiltered so task force allocations stay live too; reloads are debounced.
    const channel = supabase
      .channel(`volunteer-resources-${volunteerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "resource_allocation" }, scheduleReload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [volunteerId, scheduleReload]);

  const handleUpdateStatus = async (id: string, status: "in_use" | "consumed" | "returned", qty?: number) => {
    setError("");
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not update this resource");
        return false;
      }
      await loadResources();
      return true;
    } catch {
      setError("Network error — please try again");
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-void flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-dim text-[11px] uppercase">Loading resources...</p>
        </div>
      </div>
    );
  }

  const totalActive = mine.length + taskForce.length;

  return (
    <div className="min-h-screen bg-void pb-20">
      <div className="bg-surface-1 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-orange uppercase tracking-wider">MY RESOURCES</h1>
            <p className="font-mono text-[10px] text-muted mt-0.5">Supplies and equipment issued to you</p>
          </div>
          {totalActive > 0 && (
            <span className="font-mono text-[10px] text-ops bg-ops/10 border border-ops/30 px-2 py-1">
              {totalActive} ACTIVE
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {error && <p className="font-mono text-[11px] text-alert" role="alert">{error}</p>}

        {mine.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] text-orange uppercase tracking-wider mb-3">ASSIGNED TO YOU</h2>
            <div className="space-y-3">
              {mine.map((allocation) => (
                <MyResourceCard key={allocation.id} allocation={allocation} onUpdateStatus={handleUpdateStatus} />
              ))}
            </div>
          </section>
        )}

        {taskForce.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] text-orange uppercase tracking-wider mb-3">TASK FORCE SHARED</h2>
            <div className="space-y-3">
              {taskForce.map((allocation) => (
                <MyResourceCard key={allocation.id} allocation={allocation} onUpdateStatus={handleUpdateStatus} />
              ))}
            </div>
          </section>
        )}

        {totalActive === 0 && history.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-surface-2 mx-auto mb-4 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              </svg>
            </div>
            <p className="font-mono text-dim text-sm uppercase tracking-wider">NO RESOURCES ASSIGNED</p>
            <p className="font-mono text-dim text-xs mt-2">Resources allocated to you will appear here</p>
          </div>
        )}

        {history.length > 0 && (
          <section>
            <button
              onClick={() => setShowHistory(!showHistory)}
              aria-expanded={showHistory}
              className="w-full flex items-center justify-between border-t border-border-dim pt-3"
            >
              <h2 className="font-mono text-[10px] text-orange uppercase tracking-wider">HISTORY ({history.length})</h2>
              <span className="font-mono text-[10px] text-dim">{showHistory ? "▲ HIDE" : "▼ SHOW"}</span>
            </button>

            {showHistory && (
              <div className="space-y-2 mt-3">
                {history.map((allocation) => (
                  <div key={allocation.id} className="bg-surface-2 p-3 border border-border-dim opacity-80">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-display font-semibold text-ink uppercase text-sm">
                          {allocation.resource?.name || "Resource"}
                        </h3>
                        <p className="font-mono text-[10px] text-muted">
                          {allocation.quantity_allocated} {allocation.resource?.unit || "units"}
                          {" · "}used {allocation.quantity_consumed ?? 0}, returned {allocation.quantity_returned ?? 0}
                        </p>
                        {allocation.notes && <p className="font-mono text-[10px] text-dim italic">{allocation.notes}</p>}
                      </div>
                      <StatusPill status={allocation.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
