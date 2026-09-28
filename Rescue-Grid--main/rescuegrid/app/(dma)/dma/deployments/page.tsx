"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import CreateTaskForceModal from "@/components/dma/CreateTaskForceModal";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { assignmentStatusLabel } from "@/lib/status";

interface TaskForceMember {
  volunteer_id: string;
  member_type: string | null;
  volunteer?: {
    id: string;
    name: string;
    type: string | null;
    status: string;
  } | null;
}

interface TaskForce {
  id: string;
  name: string;
  status: string;
  assignment_id: string | null;
  created_at: string;
  member_count: number;
  members: TaskForceMember[];
  assignment_name: string | null;
  assignment_status: string | null;
}

export default function DeploymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [taskForces, setTaskForces] = useState<TaskForce[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchTaskForces = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/taskforce/list", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTaskForces(Array.isArray(data) ? data : []);
      }
    } catch {
      // keep last data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTaskForces();
  }, [fetchTaskForces]);

  const scheduleRefresh = useDebouncedCallback(() => void fetchTaskForces(), 400);
  useRealtimeSubscription([
    { table: "task_force", onInsert: scheduleRefresh, onUpdate: scheduleRefresh, onDelete: scheduleRefresh },
    { table: "task_force_member", onInsert: scheduleRefresh, onUpdate: scheduleRefresh, onDelete: scheduleRefresh },
  ]);

  const handleDissolve = async (tf: TaskForce) => {
    if (!window.confirm(`Dissolve "${tf.name}"? Members keep their chat history but the team will no longer receive missions.`)) return;
    setActionLoading(tf.id);
    setError("");
    try {
      const res = await fetch(`/api/dma/taskforce/${tf.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dissolved" }),
      });
      if (res.ok) {
        setTaskForces((prev) => prev.map((t) => (t.id === tf.id ? { ...t, status: "dissolved" } : t)));
      } else {
        setError("Could not dissolve the task force");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setActionLoading(null);
    }
  };

  const sortedTaskForces = useMemo(
    () =>
      [...taskForces].sort(
        (a, b) => Number(b.status === "active") - Number(a.status === "active") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [taskForces]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-[52px] p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 mt-6">
          <div>
            <h1 className="font-inter text-[28px] font-bold uppercase tracking-wide text-gray-900">TASK FORCES</h1>
            <p className="font-ibm-mono text-[11px] text-gray-500 uppercase tracking-wider mt-1">
              {taskForces.filter((tf) => tf.status === "active").length} ACTIVE · {taskForces.filter((tf) => tf.status === "dissolved").length} DISSOLVED
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>+ CREATE TASK FORCE</Button>
        </div>

        {error && <p className="mb-3 font-mono text-[11px] text-alert" role="alert">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white border border-gray-100 animate-pulse" />)}
          </div>
        ) : sortedTaskForces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-[48px] mb-4 opacity-40">👥</div>
            <p className="font-inter text-[13px] text-gray-500 uppercase tracking-wider">NO TASK FORCES</p>
            <p className="font-ibm-mono text-[11px] text-gray-500 mt-2">Create a task force to organize volunteer teams</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTaskForces.map((tf) => {
              const isExpanded = expandedId === tf.id;
              const isActioning = actionLoading === tf.id;

              return (
                <div
                  key={tf.id}
                  className={`bg-white border border-gray-100 border-l-[3px] rounded-sm shadow-sm overflow-hidden ${
                    tf.status === "active" ? "border-l-green-500" : "border-l-gray-300 opacity-75"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : tf.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-ibm-mono text-[10px] text-orange uppercase">TF</span>
                          <StatusBadge status={tf.status === "active" ? "ready" : "standby"} label={tf.status.toUpperCase()} />
                          <span className="font-ibm-mono text-[10px] text-gray-500 uppercase">
                            {tf.member_count} MEMBER{tf.member_count !== 1 ? "S" : ""}
                          </span>
                        </div>
                        <p className="font-inter text-[14px] text-gray-900 font-semibold">{tf.name}</p>
                        {tf.assignment_name && (
                          <p className="font-ibm-mono text-[10px] text-blue-600 truncate mt-1">
                            📍 {tf.assignment_name}
                            {tf.assignment_status && ` · ${assignmentStatusLabel(tf.assignment_status)}`}
                          </p>
                        )}
                      </div>
                      <div className="font-ibm-mono text-[10px] text-gray-500 shrink-0">
                        {new Date(tf.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {tf.members?.length > 0 && (
                        <div>
                          <div className="font-ibm-mono text-[10px] text-gray-500 uppercase tracking-wider mb-2">MEMBERS</div>
                          <div className="grid grid-cols-2 gap-2">
                            {tf.members.map((member, idx) => (
                              <div key={member.volunteer_id || idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-sm">
                                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center font-inter text-[11px] text-green-700 font-bold">
                                  {member.volunteer?.name?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <div className="font-inter text-[12px] text-gray-900">
                                    {member.volunteer?.name || "Unknown"}
                                    {member.member_type === "leader" && <span className="ml-1 text-[9px] text-orange">★ LEAD</span>}
                                  </div>
                                  <div className="font-ibm-mono text-[9px] text-gray-500">
                                    {member.volunteer?.type || "Individual"} · {member.volunteer?.status || "unknown"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                        <Button variant="secondary" size="small" onClick={() => router.push(`/dma/messages?tf=${tf.id}`)}>
                          📢 OPEN ROOM
                        </Button>
                        {tf.status === "active" && (
                          <Button variant="danger" size="small" onClick={() => handleDissolve(tf)} disabled={isActioning}>
                            {isActioning ? "DISSOLVING..." : "✗ DISSOLVE"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskForceModal onClose={() => setShowCreateModal(false)} onCreated={fetchTaskForces} />
      )}
    </div>
  );
}
