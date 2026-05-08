"use client";

interface ResourceAllocation {
  id: string;
  resource?: { name: string; type: string; unit: string };
  task_force?: { name: string };
  quantity_allocated: number;
  status: string;
  allocated_at: string;
}

interface TFSharedResourcesProps {
  allocations: ResourceAllocation[];
}

export default function TFSharedResources({ allocations }: TFSharedResourcesProps) {
  if (allocations.length === 0) return null;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-[10px] text-orange uppercase tracking-wider">
        TASK FORCE SHARED
      </h3>
      
      {allocations.map((allocation) => (
        <div key={allocation.id} className="bg-surface-2 p-4 clip-path-tactical-sm opacity-80">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-display font-semibold text-ink uppercase text-sm">
                {allocation.resource?.name || "Resource"}
              </h4>
              <p className="font-mono text-[10px] text-muted">
                {allocation.quantity_allocated} {allocation.resource?.unit || "units"}
              </p>
            </div>
            <span className="px-2 py-0.5 bg-intel/20 text-intel font-mono text-[10px] uppercase">
              {allocation.status.replace("_", " ")}
            </span>
          </div>

          {allocation.task_force?.name && (
            <p className="font-mono text-[10px] text-orange">
              TF: {allocation.task_force.name}
            </p>
          )}

          <p className="font-mono text-[10px] text-dim mt-2">
            Allocated: {formatTime(allocation.allocated_at)}
          </p>
        </div>
      ))}
    </div>
  );
}
