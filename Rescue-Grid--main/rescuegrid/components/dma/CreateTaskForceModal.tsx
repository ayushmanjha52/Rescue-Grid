"use client";

import { useState, useEffect, useMemo } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { isAssignmentDone } from "@/lib/status";

interface Volunteer {
  id: string;
  name: string;
  type: string | null;
  status: string;
}

interface Assignment {
  id: string;
  task: string;
  status: string;
  assigned_to_taskforce: string | null;
}

interface CreateTaskForceModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

function volunteerBadge(status: string): "ready" | "on-mission" | "standby" {
  if (status === "active") return "ready";
  if (status === "on-mission") return "on-mission";
  return "standby";
}

export default function CreateTaskForceModal({ onClose, onCreated }: CreateTaskForceModalProps) {
  useEscapeKey(onClose);
  const [name, setName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/volunteer/list").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/dma/assignment/list").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([vols, assigns]: [Volunteer[], Assignment[]]) => {
        setVolunteers(Array.isArray(vols) ? vols : []);
        // Missions that are still open and not already handled by a task force.
        setAssignments(Array.isArray(assigns) ? assigns.filter((a) => !isAssignmentDone(a.status) && !a.assigned_to_taskforce) : []);
      })
      .catch(() => setError("Could not load volunteers"));
  }, []);

  const visibleVolunteers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return volunteers
      .filter((v) => !query || v.name.toLowerCase().includes(query) || (v.type || "").toLowerCase().includes(query))
      .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || a.name.localeCompare(b.name));
  }, [volunteers, search]);

  const toggleMember = (volunteerId: string) => {
    setSelectedMembers((prev) => (prev.includes(volunteerId) ? prev.filter((id) => id !== volunteerId) : [...prev, volunteerId]));
  };

  const isValid = name.trim().length > 0 && selectedMembers.length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dma/taskforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          member_ids: selectedMembers,
          assignment_id: selectedAssignment || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create task force");
      }

      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task force");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-tf-title">
      <div className="w-[600px] max-w-full max-h-[85vh] overflow-y-auto bg-surface-2 border-t-[2px] border-orange clip-path-tactical">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="create-tf-title" className="font-display text-[24px] font-bold uppercase tracking-wide text-ink">
              CREATE TASK FORCE
            </h2>
            <button onClick={onClose} className="font-mono text-[11px] text-dim uppercase tracking-wider hover:text-ink transition-colors">
              ✕ CLOSE
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-alert/10 border border-alert/30 font-mono text-[11px] text-alert" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="tf-name" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                NAME *
              </label>
              <input
                id="tf-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Alpha Team, Rescue Squad, etc..."
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange"
              />
            </div>

            <div>
              <label htmlFor="tf-member-search" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-2">
                MEMBERS * <span className="text-dim normal-case tracking-normal">({selectedMembers.length} selected — first selected is the leader)</span>
              </label>
              <input
                id="tf-member-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or type..."
                className="w-full px-3 py-2 mb-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange"
              />

              <div className="max-h-56 overflow-y-auto border border-border-dim bg-surface-3">
                {visibleVolunteers.length === 0 ? (
                  <div className="p-4 font-mono text-[11px] text-dim text-center">No volunteers found</div>
                ) : (
                  visibleVolunteers.map((vol) => {
                    const isSelected = selectedMembers.includes(vol.id);
                    return (
                      <button
                        key={vol.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleMember(vol.id)}
                        className={`w-full flex items-center justify-between p-3 border-b border-border-dim/50 last:border-b-0 transition-colors text-left ${
                          isSelected ? "bg-ops/10 border-l-4 border-l-ops" : "hover:bg-surface-4"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 border ${isSelected ? "border-ops bg-ops" : "border-border-dim"} flex items-center justify-center`}>
                            {isSelected && <span className="text-white text-[10px]">✓</span>}
                          </div>
                          <div>
                            <div className="font-body text-[13px] text-ink font-semibold">{vol.name}</div>
                            <div className="font-mono text-[10px] text-dim">{vol.type || "Individual"}</div>
                          </div>
                        </div>
                        <StatusBadge status={volunteerBadge(vol.status)} label={vol.status === "offline" ? "OFFLINE" : undefined} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label htmlFor="tf-mission" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                HAND OVER A MISSION (optional)
              </label>
              <select
                id="tf-mission"
                value={selectedAssignment}
                onChange={(e) => setSelectedAssignment(e.target.value)}
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
              >
                <option value="">None</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.task.substring(0, 60)}{a.task.length > 60 ? "..." : ""}
                  </option>
                ))}
              </select>
              {selectedAssignment && (
                <p className="mt-1 font-mono text-[10px] text-caution">The mission will be reassigned to this task force.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <Button variant="ghost" onClick={onClose} disabled={loading}>CANCEL</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!isValid || loading}>
              {loading ? "CREATING..." : "CREATE TASK FORCE"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
