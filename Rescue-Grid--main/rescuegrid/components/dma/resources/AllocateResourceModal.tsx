"use client";

import { useState, useEffect } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { isAssignmentDone } from "@/lib/status";
import type { ResourceWithAllocation } from "./ResourceCard";

interface AllocationTarget {
  id: string;
  label: string;
}

interface AllocateResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllocated: () => void;
  resource: ResourceWithAllocation;
}

type TargetType = "assignment" | "task_force" | "volunteer";

export default function AllocateResourceModal({ isOpen, onClose, onAllocated, resource }: AllocateResourceModalProps) {
  useEscapeKey(onClose, isOpen);
  const [quantity, setQuantity] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("assignment");
  const [targets, setTargets] = useState<Record<TargetType, AllocationTarget[]>>({ assignment: [], task_force: [], volunteer: [] });
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const available = resource.quantity_available ?? resource.quantity - (resource.quantity_allocated || 0);
  const unit = resource.unit || "units";

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/dma/assignment/list").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/dma/taskforce/list").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/volunteer/list").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([assignments, taskForces, volunteers]) => {
        if (cancelled) return;
        setTargets({
          assignment: (Array.isArray(assignments) ? assignments : [])
            .filter((a: { status: string }) => !isAssignmentDone(a.status))
            .map((a: { id: string; task: string; assignee_name?: string }) => ({
              id: a.id,
              label: `${a.task.slice(0, 60)}${a.assignee_name && a.assignee_name !== "Unassigned" ? ` → ${a.assignee_name}` : ""}`,
            })),
          task_force: (Array.isArray(taskForces) ? taskForces : [])
            .filter((t: { status: string }) => t.status === "active")
            .map((t: { id: string; name: string; member_count?: number }) => ({ id: t.id, label: `${t.name} (${t.member_count ?? 0} members)` })),
          volunteer: (Array.isArray(volunteers) ? volunteers : [])
            .filter((v: { status: string }) => v.status === "active" || v.status === "on-mission")
            .map((v: { id: string; name: string; status: string }) => ({ id: v.id, label: `${v.name}${v.status === "on-mission" ? " (on mission)" : ""}` })),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load recipients");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Valid quantity is required");
      return;
    }
    if (qty > available) {
      setError(`Only ${available} ${unit} available`);
      return;
    }
    if (!selectedTargetId) {
      setError("Please select who receives it");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/dma/resource/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resource.id,
          quantity: qty,
          notes: notes.trim() || null,
          [`${targetType}_id`]: selectedTargetId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to allocate");
      }

      onAllocated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate resource");
    } finally {
      setSaving(false);
    }
  };

  const options = targets[targetType];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="allocate-title">
      <div className="bg-white w-full max-w-md clip-path-tactical shadow-xl">
        <div className="border-b-2 border-orange px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h2 id="allocate-title" className="font-display font-semibold text-lg text-orange uppercase tracking-wider">ALLOCATE {resource.name}</h2>
              <p className="font-mono text-[10px] text-dim">{available} {unit} available of {resource.quantity}</p>
            </div>
            <button onClick={onClose} className="text-muted hover:text-ink text-xl" aria-label="Close">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <InputField
            label={`Quantity (${unit}) *`}
            id="allocate-quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={`Up to ${available}`}
            min="1"
            max={available}
            step="any"
            required
          />

          <div>
            <span className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] mb-2 block">ALLOCATE TO *</span>
            <div className="flex gap-2 mb-3">
              {(["assignment", "task_force", "volunteer"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={targetType === type}
                  onClick={() => {
                    setTargetType(type);
                    setSelectedTargetId("");
                  }}
                  className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                    targetType === type ? "bg-orange text-white border-orange" : "bg-transparent text-muted border-border-dim hover:border-orange"
                  }`}
                >
                  {type === "task_force" ? "TASK FORCE" : type === "assignment" ? "MISSION" : "VOLUNTEER"}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="text-muted font-mono text-xs">Loading...</div>
            ) : (
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                aria-label="Recipient"
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4"
              >
                <option value="">{options.length === 0 ? "Nothing available" : "Select..."}</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="allocate-notes" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] mb-1 block">NOTES</label>
            <textarea
              id="allocate-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pickup point, delivery details, special instructions..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 resize-none"
            />
          </div>

          {error && <p className="text-alert font-mono text-xs" role="alert">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>CANCEL</Button>
            <Button type="submit" disabled={saving || available <= 0}>{saving ? "ALLOCATING..." : "CONFIRM ALLOCATE"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
