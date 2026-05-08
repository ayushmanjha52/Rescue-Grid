"use client";

import Button from "@/components/ui/Button";

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

interface AllocationCardProps {
  allocation: Allocation;
  onStatusUpdate: (id: string, status: string) => void;
  showActions?: boolean;
}

export default function AllocationCard({ allocation, onStatusUpdate, showActions = true }: AllocationCardProps) {
  const getStatusBadge = () => {
    const statusColors: Record<string, string> = {
      allocated: "bg-intel/20 text-intel",
      in_use: "bg-orange/20 text-orange",
      consumed: "bg-ops/20 text-ops",
      returned: "bg-caution/20 text-caution",
      lost: "bg-alert/20 text-alert",
    };
    return (
      <span className={`px-2 py-0.5 font-mono text-[10px] uppercase ${statusColors[allocation.status] || "bg-surface-3 text-muted"}`}>
        {allocation.status.replace("_", " ")}
      </span>
    );
  };

  const getTargetLabel = () => {
    if (allocation.assignment?.task) {
      return (
        <div className="text-[10px] font-mono">
          <span className="text-orange">To:</span>{" "}
          <span className="text-muted">Assignment &quot;{allocation.assignment.task}&quot;</span>
        </div>
      );
    }
    if (allocation.task_force?.name) {
      return (
        <div className="text-[10px] font-mono">
          <span className="text-orange">TF:</span>{" "}
          <span className="text-muted">{allocation.task_force.name}</span>
        </div>
      );
    }
    if (allocation.volunteer?.name) {
      return (
        <div className="text-[10px] font-mono">
          <span className="text-orange">Volunteer:</span>{" "}
          <span className="text-muted">{allocation.volunteer.name}</span>
        </div>
      );
    }
    return null;
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

      <div className="space-y-1 mb-3">
        {getTargetLabel()}
        {allocation.notes && (
          <p className="text-[10px] font-mono text-dim italic">&quot;{allocation.notes}&quot;</p>
        )}
      </div>

      <div className="flex justify-between text-[10px] font-mono text-dim mb-3">
        <span>Allocated: {formatTime(allocation.allocated_at)}</span>
      </div>

      {showActions && allocation.status !== "consumed" && allocation.status !== "returned" && allocation.status !== "lost" && (
        <div className="flex gap-2 border-t border-border-dim pt-3">
          {allocation.status === "allocated" && (
            <Button size="small" variant="secondary" onClick={() => onStatusUpdate(allocation.id, "in_use")}>
              MARK IN USE
            </Button>
          )}
          <Button size="small" variant="secondary" onClick={() => onStatusUpdate(allocation.id, "consumed")}>
            CONSUMED
          </Button>
          <Button size="small" variant="ghost" onClick={() => onStatusUpdate(allocation.id, "returned")}>
            RETURNED
          </Button>
        </div>
      )}
    </div>
  );
}
