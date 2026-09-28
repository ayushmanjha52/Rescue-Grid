"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import StatusTimeline from "@/components/victim/StatusTimeline";
import type { VictimReport } from "@/hooks/useNeeds";
import type { Assignment } from "@/hooks/useAssignments";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { formatRelative, useNow } from "@/hooks/useNow";
import {
  assignmentStatusLabel,
  isAssignmentDone,
  isAssignmentInProgress,
  REPORT_STATUSES,
  URGENCIES,
} from "@/lib/status";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  verified: "Verified",
  assigned: "Assigned",
  en_route: "En Route",
  arrived: "Arrived",
  resolved: "Resolved",
  duplicate: "Duplicate",
};

interface ResourceAllocation {
  id: string;
  quantity_allocated: number;
  status: string;
  resource: { name: string; type: string; unit: string | null } | null;
}

interface Responder {
  id: string;
  name: string;
  type: string | null;
  status: string;
  last_seen: string | null;
  resource_allocations?: ResourceAllocation[];
}

interface MissionCounter {
  queue: number;
  active: number;
  duplicate: number;
  done: number;
}

type MissionFilter = "open" | "active" | "duplicate" | "done" | null;

interface RightSidebarProps {
  selectedReport: VictimReport | null;
  onCreateAssignment: (reportId: string) => void;
  onResolveReport: (reportId: string) => void;
}

const RESPONDER_ORDER: Record<string, number> = { "on-mission": 0, active: 1, standby: 2, offline: 3 };

function responderBadge(status: string): "on-mission" | "ready" | "standby" {
  if (status === "on-mission") return "on-mission";
  if (status === "active") return "ready";
  return "standby";
}

export default function RightSidebar({ selectedReport, onCreateAssignment, onResolveReport }: RightSidebarProps) {
  const now = useNow(60000);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [missions, setMissions] = useState<Assignment[]>([]);
  const [missionFilter, setMissionFilter] = useState<MissionFilter>(null);
  const [counters, setCounters] = useState<MissionCounter>({ queue: 0, active: 0, duplicate: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    try {
      const [countsRes, listRes] = await Promise.all([
        fetch("/api/dma/assignment/counts", { cache: "no-store" }),
        fetch("/api/dma/assignment/list", { cache: "no-store" }),
      ]);
      if (countsRes.ok) setCounters(await countsRes.json());
      if (listRes.ok) {
        const data = await listRes.json();
        setMissions(Array.isArray(data) ? data : []);
      }
    } catch {
      // keep last data
    }
  }, []);

  const fetchResponders = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/list", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setResponders(Array.isArray(data) ? data : []);
      }
    } catch {
      // keep last data
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchMissions(), fetchResponders()]).finally(() => setLoading(false));
  }, [fetchMissions, fetchResponders]);

  const scheduleMissionRefresh = useDebouncedCallback(() => void fetchMissions(), 400);
  const scheduleResponderRefresh = useDebouncedCallback(() => void fetchResponders(), 800);

  useRealtimeSubscription<Responder>([
    { table: "assignment", onInsert: scheduleMissionRefresh, onUpdate: scheduleMissionRefresh, onDelete: scheduleMissionRefresh },
    {
      table: "volunteer",
      onInsert: scheduleResponderRefresh,
      onDelete: scheduleResponderRefresh,
      // Location pings only touch last_seen/status — patch in place.
      onUpdate: (updated) => {
        setResponders((current) =>
          current.map((r) => (r.id === updated.id ? { ...r, name: updated.name, status: updated.status, last_seen: updated.last_seen } : r))
        );
      },
    },
    { table: "resource_allocation", onInsert: scheduleResponderRefresh, onUpdate: scheduleResponderRefresh, onDelete: scheduleResponderRefresh },
  ]);

  const reportMissions = useMemo(
    () => (selectedReport ? missions.filter((m) => m.victim_report_id === selectedReport.id) : []),
    [missions, selectedReport]
  );
  const hasOpenMission = reportMissions.some((m) => !isAssignmentDone(m.status));

  const updateReport = async (changes: { status?: string; urgency?: string }) => {
    if (!selectedReport) return;
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const res = await fetch("/api/dma/report/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: selectedReport.id, ...changes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update report");
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selectedReport || newStatus === selectedReport.status) return;
    // Resolving goes through the resolve flow so open missions get closed too.
    if (newStatus === "resolved") {
      onResolveReport(selectedReport.id);
      return;
    }
    void updateReport({ status: newStatus });
  };

  const sortedResponders = useMemo(
    () => [...responders].sort((a, b) => (RESPONDER_ORDER[a.status] ?? 4) - (RESPONDER_ORDER[b.status] ?? 4) || a.name.localeCompare(b.name)),
    [responders]
  );

  const missionsToDisplay = missions.filter((m) => {
    if (missionFilter === "done") return isAssignmentDone(m.status);
    if (missionFilter === "open") return m.status === "open";
    if (missionFilter === "duplicate") return m.status === "duplicate";
    if (missionFilter === "active") return isAssignmentInProgress(m.status);
    return !isAssignmentDone(m.status) && m.status !== "duplicate";
  }).slice(0, 50);

  const missionListTitle =
    missionFilter === "done" ? "COMPLETED MISSIONS"
      : missionFilter === "open" ? "QUEUED MISSIONS"
      : missionFilter === "duplicate" ? "DUPLICATE MISSIONS"
      : "ACTIVE MISSIONS";

  return (
    <aside className="w-full lg:w-[340px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-border-dim lg:overflow-y-auto custom-scrollbar order-2 lg:order-3">
      <div className="p-5 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange animate-pulse" />
              <h2 className="font-inter text-[14px] font-bold uppercase tracking-[0.1em] text-ink">MISSION CONTROL</h2>
            </div>
            <div className="font-ibm-mono text-[11px] text-orange font-semibold px-2 py-0.5 bg-orange-50 rounded-sm">LIVE</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "queue", label: "QUEUE", color: "text-red-600", bg: "bg-red-50", border: "border-red-100", filter: "open" },
              { key: "active", label: "IN PROGRESS", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-100", filter: "active" },
              { key: "duplicate", label: "DUPE", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", filter: "duplicate" },
              { key: "done", label: "DONE", color: "text-green-700", bg: "bg-green-50", border: "border-green-100", filter: "done" },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setMissionFilter(missionFilter === item.filter ? null : item.filter)}
                aria-pressed={missionFilter === item.filter}
                className={`text-left transition-all border rounded-sm p-3 group ${
                  missionFilter === item.filter ? "border-orange shadow-sm bg-orange-50" : `${item.border} hover:border-orange/30 ${item.bg}`
                }`}
              >
                <div className={`font-inter text-[32px] font-bold ${item.color} leading-none mb-1 group-hover:scale-105 transition-transform`}>
                  {counters[item.key]}
                </div>
                <div className="font-inter text-[10px] text-gray-600 uppercase tracking-[0.1em] font-medium">{item.label}</div>
              </button>
            ))}
          </div>
        </section>

        {selectedReport ? (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-600">🆘</span>
              <h2 className="font-inter text-[14px] font-bold uppercase tracking-[0.1em] text-ink">ACTIVE FOCUS</h2>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
              <div className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className={`font-ibm-mono text-[11px] font-semibold uppercase tracking-wider ${
                      selectedReport.urgency === "critical" ? "text-red-600" : selectedReport.urgency === "urgent" ? "text-orange-700" : "text-blue-600"
                    }`}>
                      {selectedReport.urgency} PRIORITY
                    </div>
                    <h3 className="font-inter text-[16px] font-semibold text-ink leading-snug uppercase">{selectedReport.situation}</h3>
                    <p className="font-ibm-mono text-[10px] text-gray-500">Reported {formatRelative(selectedReport.created_at, now)}</p>
                  </div>
                  <StatusBadge status={selectedReport.status} />
                </div>

                <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="report-status" className="font-inter text-[10px] font-semibold text-orange uppercase tracking-widest block mb-1">
                      Status
                    </label>
                    <select
                      id="report-status"
                      value={selectedReport.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={isUpdating}
                      className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-sm font-ibm-mono text-[12px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-orange/20 disabled:opacity-50"
                    >
                      {REPORT_STATUSES.map((status) => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="report-urgency" className="font-inter text-[10px] font-semibold text-orange uppercase tracking-widest block mb-1">
                      Urgency
                    </label>
                    <select
                      id="report-urgency"
                      value={selectedReport.urgency}
                      onChange={(e) => void updateReport({ urgency: e.target.value })}
                      disabled={isUpdating}
                      className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-sm font-ibm-mono text-[12px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-orange/20 disabled:opacity-50 capitalize"
                    >
                      {URGENCIES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  {updateError && <p className="col-span-2 font-ibm-mono text-[10px] font-semibold text-red-600">{updateError}</p>}
                </div>

                <div className="space-y-2 py-3 border-y border-gray-100">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-[12px]">📍</span>
                    <span className="font-inter text-[14px] font-medium text-muted">
                      {[selectedReport.city, selectedReport.district].filter(Boolean).join(", ") || "Location on map"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-[12px]">📞</span>
                    <a href={`tel:${selectedReport.phone_no}`} className="font-ibm-mono text-[13px] font-medium text-muted hover:text-orange">
                      {selectedReport.phone_no}
                    </a>
                  </div>
                </div>

                {selectedReport.custom_message && (
                  <div className="bg-gray-50 p-3 border-l-2 border-orange/50 italic">
                    <p className="font-inter text-[13px] font-normal text-gray-700 leading-relaxed">
                      &ldquo;{selectedReport.custom_message}&rdquo;
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <div className="font-ibm-mono text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-4 text-center">MISSION PROGRESS</div>
                  <div className="scale-[0.85] origin-top -mx-4">
                    <StatusTimeline status={selectedReport.status} createdAt={selectedReport.created_at} />
                  </div>
                </div>

                {reportMissions.length > 0 && (
                  <div className="space-y-3 mt-2">
                    <div className="font-ibm-mono text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                      Missions ({reportMissions.length})
                    </div>
                    {reportMissions.map((mission) => (
                      <div key={mission.id} className={`p-3 border rounded-sm ${isAssignmentDone(mission.status) ? "bg-gray-50 border-gray-100" : "bg-green-50 border-green-100"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-ibm-mono text-[11px] font-semibold text-green-700 uppercase tracking-widest">
                            {assignmentStatusLabel(mission.status)}
                          </div>
                          <StatusBadge status={mission.status} size="sm" />
                        </div>
                        <div className="font-inter text-[14px] font-semibold text-ink mb-1">{mission.task}</div>
                        {mission.assignee_name && mission.assignee_name !== "Unassigned" && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`w-2 h-2 rounded-full ${mission.assignee_type === "taskforce" ? "bg-blue-500" : "bg-orange-500"}`} />
                            <span className="font-inter text-[11px] font-semibold text-ink uppercase tracking-tight">{mission.assignee_name}</span>
                            <span className="font-ibm-mono text-[8px] text-gray-500 uppercase px-1 border border-gray-200 rounded-[2px]">
                              {mission.assignee_type === "taskforce" ? "TASK FORCE" : "VOLUNTEER"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {selectedReport.status !== "resolved" && (
                    <Button variant="primary" className="flex-1 py-3" onClick={() => onCreateAssignment(selectedReport.id)}>
                      {hasOpenMission ? "+ BACKUP UNIT" : "DEPLOY UNIT →"}
                    </Button>
                  )}
                  {selectedReport.status !== "resolved" && hasOpenMission && (
                    <Button
                      variant="primary"
                      className="flex-1 py-3 bg-green-500 text-white hover:bg-green-600 border-none shadow-sm"
                      onClick={() => onResolveReport(selectedReport.id)}
                    >
                      RESOLVE ✓
                    </Button>
                  )}
                  <a
                    href={`tel:${selectedReport.phone_no}`}
                    className="flex items-center justify-center px-4 border border-gray-200 hover:bg-gray-50 transition-colors rounded-sm"
                    aria-label="Call reporter"
                  >
                    📞
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="py-12 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <div className="text-[24px] mb-2 opacity-30">🎯</div>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-wider px-8">
              Select a report from the map to view details &amp; assign units
            </p>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-orange-700 text-[15px]">⚡</span>
              <h2 className="font-inter text-[14px] font-bold uppercase tracking-[0.1em] text-ink">{missionListTitle}</h2>
            </div>
            {loading ? (
              <div className="w-8 h-4 bg-orange-50 animate-pulse rounded-full" />
            ) : (
              <span className="bg-orange-50 px-2.5 py-1 font-ibm-mono text-[11px] font-semibold text-orange-700 rounded-full border border-orange-100">
                {missionsToDisplay.length}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {loading ? (
              [1, 2].map((i) => <div key={i} className="h-24 bg-gray-50 border border-gray-100 animate-pulse rounded-sm" />)
            ) : missionsToDisplay.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-gray-200 rounded-sm bg-gray-50">
                <p className="font-inter text-[11px] font-medium text-gray-500 uppercase tracking-wider">No missions here</p>
              </div>
            ) : (
              missionsToDisplay.map((mission) => (
                <div key={mission.id} className="bg-white border border-gray-200 p-3 rounded-sm space-y-2 hover:border-orange/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="font-ibm-mono text-[11px] font-semibold text-orange-700 uppercase tracking-wider">
                      {assignmentStatusLabel(mission.status)}
                    </div>
                    <div className="font-ibm-mono text-[10px] font-medium text-gray-500">{formatRelative(mission.created_at, now)}</div>
                  </div>
                  <div className="font-inter text-[14px] font-semibold text-ink leading-snug">{mission.task}</div>
                  {mission.assignee_name && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${mission.assignee_type === "taskforce" ? "bg-blue-500" : "bg-orange-500"}`} />
                      <span className="font-inter text-[10px] text-ink font-semibold uppercase tracking-tight">{mission.assignee_name}</span>
                      <span className="font-ibm-mono text-[9px] font-medium text-gray-500 uppercase">
                        {mission.assignee_type === "taskforce" ? "TASK FORCE" : "VOLUNTEER"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <div className="font-ibm-mono text-[10px] font-medium text-gray-500 truncate pr-2">
                      FOR: {mission.victim_situation || "Standalone task"}
                    </div>
                    <div className="font-ibm-mono text-[10px] text-gray-500">ID: {mission.id.slice(0, 6)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-ink text-[15px]">📡</span>
              <h2 className="font-inter text-[14px] font-bold uppercase tracking-[0.1em] text-ink">RESPONDERS</h2>
            </div>
            <span className="bg-gray-100 px-2.5 py-1 font-ibm-mono text-[11px] font-semibold text-gray-600 rounded-full">
              {responders.filter((r) => r.status === "active" || r.status === "on-mission").length}/{responders.length}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-50 animate-pulse rounded-sm" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedResponders.map((r) => {
                const allocations = r.resource_allocations || [];
                return (
                  <div
                    key={r.id}
                    className={`group flex items-start gap-3 p-3 bg-white border border-gray-200 hover:border-orange/50 transition-color-snappy rounded-sm relative overflow-hidden ${
                      r.status === "offline" ? "opacity-60" : ""
                    }`}
                  >
                    {r.status === "on-mission" && <div className="absolute top-0 left-0 w-1 h-full bg-orange" />}
                    <div className="w-10 h-10 bg-gray-100 border border-gray-200 flex items-center justify-center font-inter text-[17px] font-bold text-ink uppercase shrink-0">
                      {r.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-inter text-[14px] font-semibold text-ink truncate pr-2">{r.name}</span>
                        <StatusBadge status={responderBadge(r.status)} size="sm" label={r.status === "offline" ? "OFFLINE" : undefined} />
                      </div>
                      <div className="font-ibm-mono text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {r.type || "Individual"} · {r.last_seen ? formatRelative(r.last_seen, now) : "never seen"}
                      </div>
                      {allocations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {allocations.map((alloc) => (
                            <div key={alloc.id} className="px-1.5 py-0.5 bg-green-50 border border-green-100 rounded-xs">
                              <span className="font-ibm-mono text-[9px] font-medium text-green-700 uppercase">
                                {alloc.quantity_allocated} {alloc.resource?.unit || ""} {alloc.resource?.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
