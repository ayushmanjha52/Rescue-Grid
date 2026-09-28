"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export interface VolunteerAllocation {
  id: string;
  resource?: { name: string; type: string; unit: string; location?: string } | null;
  assignment?: { task: string } | null;
  task_force?: { name: string } | null;
  quantity_allocated: number;
  quantity_consumed: number;
  quantity_returned: number;
  status: string;
  notes: string | null;
  allocated_at: string;
}

interface MyResourceCardProps {
  allocation: VolunteerAllocation;
  onUpdateStatus: (id: string, status: "in_use" | "consumed" | "returned", qty?: number) => Promise<boolean>;
}

const STATUS_COLORS: Record<string, string> = {
  allocated: "bg-intel/20 text-intel",
  in_use: "bg-orange/20 text-orange",
  consumed: "bg-ops/20 text-ops",
  returned: "bg-caution/20 text-caution",
  lost: "bg-alert/20 text-alert",
};

export default function MyResourceCard({ allocation, onUpdateStatus }: MyResourceCardProps) {
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [returnQty, setReturnQty] = useState("");
  const [updating, setUpdating] = useState(false);
  const [inputError, setInputError] = useState("");

  const unit = allocation.resource?.unit || "units";
  const isActive = allocation.status === "allocated" || allocation.status === "in_use";

  const run = async (status: "in_use" | "consumed" | "returned", qty?: number) => {
    setUpdating(true);
    const ok = await onUpdateStatus(allocation.id, status, qty);
    setUpdating(false);
    return ok;
  };

  const handleMarkConsumed = async () => {
    if (!window.confirm(`Mark all ${allocation.quantity_allocated} ${unit} of ${allocation.resource?.name || "this resource"} as used?`)) return;
    await run("consumed", allocation.quantity_allocated);
  };

  const handleReturn = async () => {
    const qty = Number(returnQty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > allocation.quantity_allocated) {
      setInputError(`Enter a number between 1 and ${allocation.quantity_allocated}`);
      return;
    }
    setInputError("");
    if (await run("returned", qty)) {
      setShowReturnInput(false);
      setReturnQty("");
    }
  };

  return (
    <div className="bg-surface-2 p-4 clip-path-tactical-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-display font-semibold text-ink uppercase text-sm">
            {allocation.resource?.name || "Resource"}
          </h4>
          <p className="font-mono text-[10px] text-muted">
            {allocation.quantity_allocated} {unit}
          </p>
        </div>
        <span className={`px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS_COLORS[allocation.status] || "bg-surface-3 text-muted"}`}>
          {allocation.status.replace("_", " ")}
        </span>
      </div>

      {allocation.task_force?.name && (
        <p className="font-mono text-[10px] text-ops mb-2">👥 Shared with {allocation.task_force.name}</p>
      )}

      {allocation.resource?.location && (
        <p className="font-mono text-[10px] text-dim mb-2">Pick up from: {allocation.resource.location}</p>
      )}

      {allocation.assignment?.task && (
        <p className="font-mono text-[10px] text-orange mb-2">For: {allocation.assignment.task}</p>
      )}

      {allocation.notes && (
        <p className="font-mono text-[10px] text-dim italic mb-3">&quot;{allocation.notes}&quot;</p>
      )}

      {isActive && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 border-t border-border-dim pt-3">
            {allocation.status === "allocated" && (
              <Button size="small" variant="secondary" onClick={() => run("in_use")} disabled={updating}>
                PICKED UP
              </Button>
            )}
            <Button size="small" variant="primary" onClick={handleMarkConsumed} disabled={updating}>
              ALL USED
            </Button>
            <Button size="small" variant="ghost" onClick={() => setShowReturnInput(!showReturnInput)} disabled={updating}>
              RETURN
            </Button>
          </div>

          {showReturnInput && (
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  placeholder={`Max ${allocation.quantity_allocated}`}
                  max={allocation.quantity_allocated}
                  min="1"
                  aria-label="Quantity to return"
                  className="w-24 px-2 py-1 bg-surface-3 border border-border text-ink font-mono text-xs"
                />
                <Button size="small" onClick={handleReturn} disabled={updating}>
                  CONFIRM
                </Button>
                <Button size="small" variant="ghost" onClick={() => setShowReturnInput(false)}>
                  CANCEL
                </Button>
              </div>
              <p className="font-mono text-[9px] text-dim mt-1">The rest is recorded as used.</p>
              {inputError && <p className="font-mono text-[10px] text-alert mt-1">{inputError}</p>}
            </div>
          )}
        </div>
      )}

      <p className="font-mono text-[10px] text-dim mt-2">
        Allocated: {new Date(allocation.allocated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
