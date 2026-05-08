"use client";

import { useState, useEffect } from "react";
import AllocationCard from "./AllocationCard";

interface Allocation {
  id: string;
  resource_id: string;
  resource?: { name: string; type: string; unit: string };
  assignment?: { task: string };
  task_force?: { name: string };
  volunteer?: { name: string };
  quantity_allocated: number;
  quantity_consumed: number;
  quantity_returned: number;
  status: string;
  notes: string | null;
  allocated_at: string;
}

interface ResourceAllocationListProps {
  filterResourceId?: string;
}

export default function ResourceAllocationList({ filterResourceId }: ResourceAllocationListProps) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadAllocations();
  }, [filterResourceId]);

  const loadAllocations = async () => {
    setLoading(true);
    try {
      let url = "/api/dma/resource/allocations";
      const params = new URLSearchParams();
      if (filterResourceId) params.append("resource_id", filterResourceId);
      if (statusFilter) params.append("status", statusFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      setAllocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load allocations:", err);
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/dma/resource/allocation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setAllocations((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const statuses = ["allocated", "in_use", "consumed", "returned", "lost"];

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="font-mono text-dim text-sm">Loading allocations...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setStatusFilter(""); loadAllocations(); }}
          className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
            !statusFilter ? "bg-orange text-black border-orange" : "bg-transparent text-muted border-border-dim hover:border-orange"
          }`}
        >
          ALL
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); loadAllocations(); }}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              statusFilter === s ? "bg-orange text-black border-orange" : "bg-transparent text-muted border-border-dim hover:border-orange"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {allocations.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-mono text-dim text-sm uppercase tracking-wider">
            NO ALLOCATIONS FOUND
          </p>
          <p className="font-mono text-dim text-xs mt-2">
            Resource allocations will appear here
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {allocations.map((allocation) => (
            <AllocationCard
              key={allocation.id}
              allocation={allocation}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
