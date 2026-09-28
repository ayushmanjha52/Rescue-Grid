"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import CreateAssignmentModal from "@/components/dma/CreateAssignmentModal";
import MissionTimeline from "@/components/shared/MissionTimeline";
import { useAssignments } from "@/hooks/useAssignments";
import { formatCountdown, formatRelative, useNow } from "@/hooks/useNow";
import { assignmentStatusLabel, isAssignmentDone, normalizeAssignmentStatus } from "@/lib/status";

type Filter = "pending" | "done" | "all";
type DmaStatus = "en_route" | "arrived" | "completed" | "failed";

// Minutes without any update before an in-progress mission is highlighted.
const STALE_AFTER_MIN = 30;

function badgeStatus(status: string) {
  switch (normalizeAssignmentStatus(status)) {
    case "completed": return "completed";
    case "failed": return "failed";
    case "en_route": return "en_route";
    case "arrived": return "arrived";
    case "active": return "assigned";
    default: return "pending";
  }
}

function urgencyBorder(urgency: string) {
  if (urgency === "critical") return "border-l-alert";
  if (urgency === "urgent") return "border-l-orange";
  return "border-l-intel";
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-void" />}>
      <AssignmentsContent />
    </Suspense>
  );
}

function AssignmentsContent() {
  const now = useNow(1000);
  const searchParams = useSearchParams();
  const { assignments, loading } = useAssignments("dma");
  const [filter, setFilter] = useState<Filter>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [statusNote, setStatusNote] = useState("");

  // Deep link from alerts / the volunteer roster: /dma/assignments?open=<id>
  const openParam = searchParams.get("open");
  const [handledOpen, setHandledOpen] = useState<string | null>(null);
  if (openParam && openParam !== handledOpen) {
    setHandledOpen(openParam);
    setExpandedId(openParam);
    setFilter("all");
  }

  const pendingCount = assignments.filter((a) => !isAssignmentDone(a.status)).length;
  const doneCount = assignments.length - pendingCount;

  const visible = useMemo(() => {
    const list = assignments.filter((a) =>
      filter === "all" ? true : filter === "done" ? isAssignmentDone(a.status) : !isAssignmentDone(a.status)
    );
    const rank: Record<string, number> = { critical: 0, urgent: 1, moderate: 2 };
    // Pending: most urgent first; otherwise newest first.
    return list.sort((a, b) =>
      filter === "pending"
        ? (rank[a.urgency] ?? 3) - (rank[b.urgency] ?? 3) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    );
  }, [assignments, filter]);

  const handleStatusUpdate = async (id: string, status: DmaStatus) => {
    if (status === "completed" || status === "failed") {
      const verb = status === "completed" ? "complete" : "mark as failed";
      if (!window.confirm(`Are you sure you want to ${verb} this mission? Responders will be notified.`)) return;
    }

    setActionLoading(id);
    setActionError("");
    try {
      const res = await fetch(`/api/dma/assignment/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: statusNote.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Could not update the mission");
      } else {
        setStatusNote("");
        if (status === "completed" || status === "failed") setExpandedId(null);
      }
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <div className="pt-[52px] p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 mt-6">
          <div>
            <h1 className="font-display text-[32px] font-bold uppercase tracking-wide text-ink">MISSIONS</h1>
            <p className="font-mono text-[11px] text-dim uppercase tracking-wider mt-1">
              {pendingCount} IN PROGRESS · {doneCount} CLOSED
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>+ CREATE ASSIGNMENT</Button>
        </div>

        <div className="flex gap-2 mb-4" role="tablist">
          {([
            ["pending", `In progress (${pendingCount})`],
            ["done", `Closed (${doneCount})`],
            ["all", `All (${assignments.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
                filter === key ? "bg-orange text-white border-orange" : "border-border-dim text-muted hover:border-orange"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {actionError && <p className="mb-3 font-mono text-[11px] text-alert" role="alert">{actionError}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-surface-2 animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-[48px] mb-4">📋</div>
            <p className="font-mono text-[13px] text-dim uppercase tracking-wider">
              {filter === "done" ? "NO CLOSED MISSIONS" : "NO MISSIONS IN PROGRESS"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((assignment) => {
              const isExpanded = expandedId === assignment.id;
              const isActioning = actionLoading === assignment.id;
              const isOpen = !isAssignmentDone(assignment.status);
              const countdown = isOpen ? formatCountdown(assignment.timer, now) : null;
              const lastActivity = assignment.last_update?.created_at ?? assignment.updated_at ?? assignment.created_at;
              const quietMinutes = now ? (now - new Date(lastActivity).getTime()) / 60000 : 0;
              const isStale = isOpen && quietMinutes > STALE_AFTER_MIN;
              const status = normalizeAssignmentStatus(assignment.status);

              return (
                <div key={assignment.id} className={`bg-surface-2 border-l-[3px] ${urgencyBorder(assignment.urgency)} overflow-hidden`}>
                  <button
                    type="button"
                    className="w-full text-left p-4"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedId(isExpanded ? null : assignment.id);
                      setStatusNote("");
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-[10px] text-orange uppercase">{assignment.id.slice(0, 8).toUpperCase()}</span>
                          <StatusBadge status={badgeStatus(assignment.status)} label={assignmentStatusLabel(assignment.status)} />
                          <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 ${
                            assignment.urgency === "critical" ? "text-alert bg-alert/10" :
                            assignment.urgency === "urgent" ? "text-orange bg-orange/10" :
                            "text-intel bg-intel/10"
                          }`}>
                            {assignment.urgency}
                          </span>
                        </div>
                        <p className="font-body text-[14px] text-ink line-clamp-2">{assignment.task}</p>
                        <div className="flex items-center gap-3 mt-2 font-mono text-[10px] text-dim flex-wrap">
                          <span>📍 {assignment.location_label}</span>
                          {assignment.volunteer_name && <span>👤 {assignment.volunteer_name}</span>}
                          {assignment.taskforce_name && <span>👥 {assignment.taskforce_name}</span>}
                        </div>
                        {assignment.last_update && (
                          <p className="mt-2 font-body text-[12px] text-muted line-clamp-2 whitespace-pre-wrap">
                            <span className={assignment.last_update.sender_type === "dma" ? "text-intel" : "text-ops"}>
                              {assignment.last_update.sender_type === "dma" ? "Command: " : "Latest: "}
                            </span>
                            {assignment.last_update.content}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {countdown && (
                          <div className={`font-mono text-[13px] font-bold ${countdown === "00:00:00" ? "text-alert" : "text-ops"}`}>
                            ⏱ {countdown === "00:00:00" ? "OVERDUE" : countdown}
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-dim mt-1">
                          {new Date(assignment.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {now > 0 && (
                          <div
                            className={`font-mono text-[10px] mt-1 ${isStale ? "text-caution font-bold" : "text-dim"}`}
                            title={isStale ? "No update for a while — check in with the responder" : undefined}
                          >
                            {isStale ? "⚠ " : ""}updated {formatRelative(lastActivity, now)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-dim pt-3 space-y-3">
                      <div>
                        <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-1">FULL TASK</div>
                        <p className="font-body text-[13px] text-ink whitespace-pre-wrap">{assignment.task}</p>
                      </div>

                      {assignment.victim_situation && (
                        <div>
                          <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-1">LINKED REPORT</div>
                          <p className="font-body text-[13px] text-ink">{assignment.victim_situation.toUpperCase()}</p>
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
                          <p className="font-body text-[13px] text-ink">{assignment.assignee_name || "Unassigned"}</p>
                          <div className="flex items-center gap-3 mt-1 font-mono text-[10px]">
                            {assignment.volunteer_phone && (
                              <a href={`tel:${assignment.volunteer_phone}`} className="text-orange hover:underline">
                                📞 {assignment.volunteer_phone}
                              </a>
                            )}
                            {assignment.assigned_to_volunteer && (
                              <Link href={`/dma/messages?volunteer=${assignment.assigned_to_volunteer}`} className="text-intel hover:underline">
                                💬 Direct chat
                              </Link>
                            )}
                            {assignment.assigned_to_taskforce && (
                              <Link href={`/dma/messages?tf=${assignment.assigned_to_taskforce}`} className="text-intel hover:underline">
                                💬 Team room
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-2">MISSION UPDATES</div>
                        <MissionTimeline
                          assignmentId={assignment.id}
                          endpoint={`/api/dma/assignment/${assignment.id}/updates`}
                          allowReply={isOpen && assignment.assignee_type !== "none"}
                          emptyText="No updates yet. Responders' status changes and notes appear here live."
                        />
                      </div>

                      {isOpen && (
                        <div className="pt-3 border-t border-border-dim space-y-2">
                          <div className="font-mono text-[10px] text-dim uppercase tracking-wider">
                            SET STATUS <span className="normal-case tracking-normal">— e.g. when a responder without the app calls in</span>
                          </div>
                          <input
                            value={statusNote}
                            onChange={(e) => setStatusNote(e.target.value)}
                            maxLength={500}
                            placeholder="Optional note for the log (e.g. 'Called in: 2 families evacuated')"
                            aria-label="Note for the status change"
                            className="w-full px-3 py-2 bg-surface-3 border border-border-dim font-body text-[13px] text-ink placeholder:text-dim focus:outline-none focus:border-orange"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            {status === "active" && (
                              <Button variant="secondary" size="small" onClick={() => handleStatusUpdate(assignment.id, "en_route")} disabled={isActioning}>
                                🚗 EN ROUTE
                              </Button>
                            )}
                            {(status === "active" || status === "en_route") && (
                              <Button variant="secondary" size="small" onClick={() => handleStatusUpdate(assignment.id, "arrived")} disabled={isActioning}>
                                📍 ON SITE
                              </Button>
                            )}
                            <Button variant="primary" size="small" onClick={() => handleStatusUpdate(assignment.id, "completed")} disabled={isActioning}>
                              ✓ MARK COMPLETED
                            </Button>
                            <Button variant="danger" size="small" onClick={() => handleStatusUpdate(assignment.id, "failed")} disabled={isActioning}>
                              ✗ MARK FAILED
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && <CreateAssignmentModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
