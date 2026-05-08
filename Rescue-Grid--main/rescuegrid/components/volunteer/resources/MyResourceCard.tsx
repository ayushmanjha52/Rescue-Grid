"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface ResourceAllocation {
  id: string;
  resource?: { name: string; type: string; unit: string; location?: string };
  assignment?: { task: string };
  quantity_allocated: number;
  quantity_consumed: number;
  quantity_returned: number;
  status: string;
  notes: string | null;
  allocated_at: string;
}

interface MyResourceCardProps {
  allocation: ResourceAllocation;
  onUpdateStatus: (id: string, status: string, qty?: number) => void;
}

export default function MyResourceCard({ allocation, onUpdateStatus }: MyResourceCardProps) {
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [returnQty, setReturnQty] = useState("");
  const [updating, setUpdating] = useState(false);

  const getStatusBadge = () => {
    const statusColors: Record<string, string> = {
      allocated: "bg-intel/20 text-intel",
      in_use: "bg-orange/20 text-orange",
      consumed: "bg-ops/20 text-ops",
      returned: "bg-caution/20 text-caution",
    };
    return (
      <span className={`px-2 py-0.5 font-mono text-[10px] uppercase ${statusColors[allocation.status] || "bg-surface-3 text-muted"}`}>
        {allocation.status.replace("_", " ")}
      </span>
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const handleMarkConsumed = async () => {
    setUpdating(true);
    await onUpdateStatus(allocation.id, "consumed", allocation.quantity_allocated);
    setUpdating(false);
  };

  const handleReturn = async () => {
    const qty = parseFloat(returnQty) || 0;
    if (qty <= 0 || qty > allocation.quantity_allocated) return;
    setUpdating(true);
    await onUpdateStatus(allocation.id, "returned", qty);
    setUpdating(false);
    setShowReturnInput(false);
    setReturnQty("");
  };

  const remaining = allocation.quantity_allocated - allocation.quantity_consumed - allocation.quantity_returned;

  return (
    <div className="bg-surface-2 p-4 clip-path-tactical-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-display font-semibold text-ink uppercase text-sm">
            {allocation.resource?.name || "Resource"}
          </h4>
          <p className="font-mono text-[10px] text-muted">
            {allocation.quantity_allocated} {allocation.resource?.unit || "units"}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {allocation.resource?.location && (
        <p className="font-mono text-[10px] text-dim mb-2">
          From: {allocation.resource.location}
        </p>
      )}

      {allocation.assignment?.task && (
        <p className="font-mono text-[10px] text-orange mb-2">
          For: {allocation.assignment.task}
        </p>
      )}

      {allocation.notes && (
        <p className="font-mono text-[10px] text-dim italic mb-3">
          &quot;{allocation.notes}&quot;
        </p>
      )}

      <div className="flex gap-4 text-[10px] font-mono text-dim mb-3">
        <span>Used: {allocation.quantity_consumed}</span>
        <span>Returned: {allocation.quantity_returned}</span>
        <span>Remaining: {remaining}</span>
      </div>

      {allocation.status !== "consumed" && allocation.status !== "returned" && (
        <div className="space-y-2">
          <div className="flex gap-2 border-t border-border-dim pt-3">
            <Button
              size="small"
              variant="primary"
              onClick={handleMarkConsumed}
              disabled={updating}
            >
              MARK CONSUMED
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => setShowReturnInput(!showReturnInput)}
              disabled={updating}
            >
              RETURN ITEM
            </Button>
          </div>

          {showReturnInput && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                placeholder={`Max: ${remaining}`}
                max={remaining}
                min="1"
                className="w-24 px-2 py-1 bg-surface-3 border border-border text-ink font-mono text-xs"
              />
              <Button size="small" onClick={handleReturn} disabled={updating}>
                CONFIRM
              </Button>
              <Button size="small" variant="ghost" onClick={() => setShowReturnInput(false)}>
                CANCEL
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="font-mono text-[10px] text-dim mt-2">
        Allocated: {formatTime(allocation.allocated_at)}
      </p>
    </div>
  );
}
