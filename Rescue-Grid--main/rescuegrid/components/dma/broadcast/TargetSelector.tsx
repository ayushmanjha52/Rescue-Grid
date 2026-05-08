"use client";

interface TaskForce {
  id: string;
  name: string;
  member_count?: number;
}

interface TargetSelectorProps {
  target: "all_volunteers" | "specific_task_force" | "everyone";
  onTargetChange: (target: "all_volunteers" | "specific_task_force" | "everyone") => void;
  taskForces: TaskForce[];
  selectedTaskForceId: string;
  onTaskForceChange: (id: string) => void;
}

export default function TargetSelector({
  target,
  onTargetChange,
  taskForces,
  selectedTaskForceId,
  onTaskForceChange,
}: TargetSelectorProps) {
  const targets = [
    { value: "all_volunteers", label: "ALL VOLUNTEERS", desc: "Active volunteers only" },
    { value: "specific_task_force", label: "SPECIFIC TASK FORCE", desc: "Select a team" },
    { value: "everyone", label: "EVERYONE", desc: "All registered volunteers" },
  ] as const;

  return (
    <div className="space-y-3">
      <label className="font-inter text-[10px] text-orange uppercase tracking-[0.2em]">
        TARGET AUDIENCE
      </label>
      
      <div className="space-y-2">
        {targets.map((t) => (
          <div key={t.value}>
            <label
              className={`flex items-center gap-3 p-3 border cursor-pointer transition-all ${
                target === t.value
                  ? "border-orange bg-orange/10"
                  : "border-border-dim hover:border-orange/50"
              }`}
            >
              <div
                className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                  target === t.value
                    ? "border-orange bg-orange"
                    : "border-muted"
                }`}
              >
                {target === t.value && (
                  <div className="w-2 h-2 bg-black" />
                )}
              </div>
              <input
                type="radio"
                name="target"
                value={t.value}
                checked={target === t.value}
                onChange={() => onTargetChange(t.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <span className="font-inter text-xs uppercase text-ink">
                  {t.label}
                </span>
                <span className="font-ibm-mono text-[10px] text-dim ml-2">
                  {t.desc}
                </span>
              </div>
            </label>

            {t.value === "specific_task_force" && target === "specific_task_force" && (
              <div className="ml-10 mt-2">
                <select
                  value={selectedTaskForceId}
                  onChange={(e) => onTaskForceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-3 border border-border-dim border-l-3 border-l-orange font-inter text-sm text-ink focus:outline-none focus:border-orange"
                >
                  <option value="">Select Task Force...</option>
                  {taskForces.map((tf) => (
                    <option key={tf.id} value={tf.id}>
                      {tf.name} {tf.member_count ? `(${tf.member_count} members)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
