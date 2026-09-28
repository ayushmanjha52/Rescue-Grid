"use client";

import { useState, useEffect, useCallback } from "react";
import AllocationCard, { type Allocation } from "./AllocationCard";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { ALLOCATION_STATUSES } from "@/lib/status";

interface ResourceAllocationListProps {
  filterResourceId?: string;
}

export default function ResourceAllocationList({ filterResourceId }: ResourceAllocationListProps) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState("");

  const loadAllocations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterResourceId) params.append("resource_id", filterResourceId);
      if (statusFilter) params.append("status", statusFilter);
      const res = await fetch(`/api/dma/resource/allocations${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      setAllocations(Array.isArray(data) ? data : []);
    } catch {
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, [filterResourceId, statusFilter]);

  useEffect(() => {
    void loadAllocations();
  }, [loadAllocations]);

  const scheduleReload = useDebouncedCallback(() => void loadAllocations(), 300);
  useRealtimeSubscription([
    { table: "resource_allocation", onInsert: scheduleReload, onUpdate: scheduleReload, onDelete: scheduleReload },
  ]);

  const handleStatusUpdate = async (id: string, status: string) => {
    setError("");
    try {
      const res = await fetch(`/api/dma/resource/allocation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not update allocation");
        return;
      }
      await loadAllocations();
    } catch {
      setError("Network error — please try again");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap" role="tablist">
        {["", ...ALLOCATION_STATUSES].map((s) => (
          <button
            key={s || "all"}
            role="tab"
            aria-selected={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              statusFilter === s ? "bg-orange text-white border-orange" : "bg-transparent text-muted border-border-dim hover:border-orange"
            }`}
          >
            {s ? s.replace("_", " ") : "ALL"}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 font-mono text-[11px] text-alert" role="alert">{error}</p>}

      {loading ? (
        <p className="text-center py-8 font-mono text-dim text-sm">Loading allocations...</p>
      ) : allocations.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-mono text-dim text-sm uppercase tracking-wider">NO ALLOCATIONS FOUND</p>
          <p className="font-mono text-dim text-xs mt-2">Resource allocations will appear here</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {allocations.map((allocation) => (
            <AllocationCard key={allocation.id} allocation={allocation} onStatusUpdate={handleStatusUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
