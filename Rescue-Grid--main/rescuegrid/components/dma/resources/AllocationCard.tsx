"use client";

import Button from "@/components/ui/Button";
import { formatRelative, useNow } from "@/hooks/useNow";

export interface Allocation {
  id: string;
  resource_id: string;
  resource?: { name: string; type: string; unit: string | null } | null;
  assignment?: { task: string } | null;
  task_force?: { name: string } | null;
  volunteer?: { name: string } | null;
  quantity_allocated: number;
  quantity_consumed: number;
  quantity_returned: number;
  status: string;
  notes: string | null;
  allocated_at: string;
}

interface AllocationCardProps {
  allocation: Allocation;
  onStatusUpdate: (id: string, status: string) => void;
  showActions?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  allocated: "bg-intel/20 text-intel",
  in_use: "bg-orange/20 text-orange",
  consumed: "bg-ops/20 text-ops",
  returned: "bg-caution/20 text-caution",
  lost: "bg-alert/20 text-alert",
};

export default function AllocationCard({ allocation, onStatusUpdate, showActions = true }: AllocationCardProps) {
  const now = useNow(60000);
  const unit = allocation.resource?.unit || "units";
  const isActive = allocation.status === "allocated" || allocation.status === "in_use";

  const confirmAndUpdate = (status: string, message: string) => {
    if (window.confirm(message)) onStatusUpdate(allocation.id, status);
  };

  const recipient = allocation.assignment?.task
    ? { label: "Mission", value: allocation.assignment.task }
    : allocation.task_force?.name
      ? { label: "Task force", value: allocation.task_force.name }
      : allocation.volunteer?.name
        ? { label: "Volunteer", value: allocation.volunteer.name }
        : null;

  return (
    <div className="bg-white border border-gray-100 p-4 clip-path-tactical-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-display font-semibold text-ink uppercase text-sm">{allocation.resource?.name || "Resource"}</h4>
          <p className="font-mono text-[10px] text-muted">{allocation.quantity_allocated} {unit}</p>
        </div>
        <span className={`px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS_COLORS[allocation.status] || "bg-surface-3 text-muted"}`}>
          {allocation.status.replace("_", " ")}
        </span>
      </div>

      <div className="space-y-1 mb-3">
        {recipient && (
          <div className="text-[10px] font-mono">
            <span className="text-orange">{recipient.label}:</span>{" "}
            <span className="text-muted">{recipient.value}</span>
          </div>
        )}
        {allocation.notes && <p className="text-[10px] font-mono text-dim italic">&quot;{allocation.notes}&quot;</p>}
        {!isActive && (
          <p className="text-[10px] font-mono text-dim">
            Used {allocation.quantity_consumed ?? 0} · Returned {allocation.quantity_returned ?? 0}
          </p>
        )}
      </div>

      <div className="text-[10px] font-mono text-dim mb-3">Allocated {formatRelative(allocation.allocated_at, now)}</div>

      {showActions && isActive && (
        <div className="flex flex-wrap gap-2 border-t border-border-dim pt-3">
          {allocation.status === "allocated" && (
            <Button size="small" variant="secondary" onClick={() => onStatusUpdate(allocation.id, "in_use")}>
              IN USE
            </Button>
          )}
          <Button size="small" variant="secondary" onClick={() => confirmAndUpdate("consumed", `Mark all ${allocation.quantity_allocated} ${unit} as used? Stock will be deducted.`)}>
            CONSUMED
          </Button>
          <Button size="small" variant="ghost" onClick={() => confirmAndUpdate("returned", `Mark all ${allocation.quantity_allocated} ${unit} as returned to stock?`)}>
            RETURNED
          </Button>
          <Button size="small" variant="danger" onClick={() => confirmAndUpdate("lost", `Mark this allocation as lost? ${allocation.quantity_allocated} ${unit} will be written off.`)}>
            LOST
          </Button>
        </div>
      )}
    </div>
  );
}
