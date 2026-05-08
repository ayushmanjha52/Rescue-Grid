"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import CreateAssignmentModal from "@/components/dma/CreateAssignmentModal";

interface Assignment {
  id: string;
  task: string;
  location_label: string;
  latitude: number;
  longitude: number;
  urgency: string;
  status: string;
  assigned_to_volunteer: string | null;
  assigned_to_taskforce: string | null;
  victim_report_id: string | null;
  timer: string | null;
  created_at: string;
  updated_at: string;
  volunteer_name?: string;
  taskforce_name?: string;
  victim_situation?: string;
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/dma/login");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/assignment/list");
      if (res.ok) {
        const data = await res.json();
        setAssignments(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleStatusUpdate = async (id: string, status: "completed" | "failed") => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/dma/assignment/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
        setExpandedId(null);
      }
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string): "critical" | "on-mission" | "ready" | "standby" | "completed" => {
    if (status === "active") return "on-mission";
    if (status === "open") return "standby";
    if (status === "completed") return "completed";
    if (status === "failed") return "critical";
    return "standby";
  };

  const getUrgencyColor = (urgency: string) => {
    if (urgency === "critical") return "border-l-alert";
    if (urgency === "urgent") return "border-l-orange";
    return "border-l-intel";
  };

  const getTimerCountdown = (timer: string | null) => {
    if (!timer) return null;
    const diff = new Date(timer).getTime() - Date.now();
    if (diff <= 0) return "EXPIRED";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const sortedAssignments = [...assignments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-void">
        <span className="font-mono text-[11px] text-dim uppercase tracking-wider">AUTHENTICATING...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void">
      <div className="pt-[52px] p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[32px] font-bold uppercase tracking-wide text-ink">
              ASSIGNMENTS
            </h1>
            <p className="font-mono text-[11px] text-dim uppercase tracking-wider mt-1">
              {assignments.filter(a => a.status === "active" || a.status === "open").length} ACTIVE · {assignments.filter(a => a.status === "completed" || a.status === "failed").length} COMPLETED
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            + CREATE ASSIGNMENT
          </Button>
        </div>

        {sortedAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-[48px] mb-4">📋</div>
            <p className="font-mono text-[13px] text-dim uppercase tracking-wider">
              NO ACTIVE MISSIONS
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAssignments.map((assignment) => {
              const isExpanded = expandedId === assignment.id;
              const isActioning = actionLoading === assignment.id;
              const timerDisplay = getTimerCountdown(assignment.timer);

              return (
                <div
                  key={assignment.id}
                  className={`bg-surface-2 border-l-[3px] ${getUrgencyColor(assignment.urgency)} overflow-hidden`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-orange uppercase">
                            {assignment.id.slice(0, 8).toUpperCase()}
                          </span>
                          <StatusBadge status={getStatusBadge(assignment.status)} />
                          <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 ${
                            assignment.urgency === "critical" ? "text-alert bg-alert/10" :
                            assignment.urgency === "urgent" ? "text-orange bg-orange/10" :
                            "text-intel bg-intel/10"
                          }`}>
                            {assignment.urgency}
                          </span>
                        </div>
                        <p className="font-body text-[14px] text-ink line-clamp-2">
                          {assignment.task}
                        </p>
                        <div className="flex items-center gap-3 mt-2 font-mono text-[10px] text-dim">
                          <span>📍 {assignment.location_label}</span>
                          {assignment.volunteer_name && (
                            <span>👤 {assignment.volunteer_name}</span>
                          )}
                          {assignment.taskforce_name && (
                            <span>🔴 {assignment.taskforce_name}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {timerDisplay && (
                          <div className={`font-mono text-[13px] font-bold ${timerDisplay === "EXPIRED" ? "text-alert" : "text-ops"}`}>
                            ⏱ {timerDisplay}
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-dim mt-1">
                          {new Date(assignment.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-dim/50 pt-3">
                      <div className="space-y-3">
                        <div>
                          <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-1">FULL TASK</div>
                          <p className="font-body text-[13px] text-ink">{assignment.task}</p>
                        </div>

                        {assignment.victim_situation && (
                          <div>
                            <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-1">LINKED REPORT</div>
                            <p className="font-body text-[13px] text-ink">
                              {assignment.victim_situation.toUpperCase()} — {assignment.location_label}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-1">COORDINATES</div>
                            <p className="font-mono text-[11px] text-ink">
                              {assignment.latitude?.toFixed(5)}, {assignment.longitude?.toFixed(5)}
                            </p>
                          </div>
                          <div>
                            <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-1">ASSIGNEE</div>
                            <p className="font-body text-[13px] text-ink">
                              {assignment.volunteer_name || assignment.taskforce_name || "Unassigned"}
                            </p>
                          </div>
                        </div>

                        {(assignment.status === "active" || assignment.status === "open") && (
                          <div className="flex items-center gap-3 pt-2 border-t border-border-dim/50">
                            <Button
                              variant="primary"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdate(assignment.id, "completed");
                              }}
                              disabled={isActioning}
                            >
                              ✓ MARK COMPLETED
                            </Button>
                            <Button
                              variant="danger"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdate(assignment.id, "failed");
                              }}
                              disabled={isActioning}
                            >
                              ✗ MARK FAILED
                            </Button>
                          </div>
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
        <CreateAssignmentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchAssignments}
        />
      )}
    </div>
  );
}