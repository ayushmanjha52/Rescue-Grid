"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";

interface AllocationTarget {
  id: string;
  name?: string;
  task?: string;
  member_count?: number;
}

interface AllocateResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllocated: () => void;
  resourceId: string;
}

export default function AllocateResourceModal({ 
  isOpen, 
  onClose, 
  onAllocated, 
  resourceId 
}: AllocateResourceModalProps) {
  const [quantity, setQuantity] = useState("");
  const [targetType, setTargetType] = useState<"assignment" | "task_force" | "volunteer">("assignment");
  const [assignments, setAssignments] = useState<AllocationTarget[]>([]);
  const [taskForces, setTaskForces] = useState<AllocationTarget[]>([]);
  const [volunteers, setVolunteers] = useState<AllocationTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignRes, tfRes, volRes] = await Promise.all([
        fetch("/api/dma/assignment/list"),
        fetch("/api/dma/taskforce/list"),
        fetch("/api/volunteer/list"),
      ]);

      const [assignData, tfData, volData] = await Promise.all([
        assignRes.json(),
        tfRes.json(),
        volRes.json(),
      ]);

      setAssignments(assignData.filter((a: { status: string }) => a.status === "active") || []);
      setTaskForces(tfData.filter((t: { status: string }) => t.status === "active") || []);
      setVolunteers(volData.filter((v: { status: string }) => v.status === "active") || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setError("Valid quantity is required");
      return;
    }
    
    if (!selectedTargetId) {
      setError("Please select a target");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        resource_id: resourceId,
        quantity: qty,
        notes: notes.trim() || null,
      };

      if (targetType === "assignment") body.assignment_id = selectedTargetId;
      else if (targetType === "task_force") body.task_force_id = selectedTargetId;
      else body.volunteer_id = selectedTargetId;

      const res = await fetch("/api/dma/resource/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to allocate");
      }

      onAllocated();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate resource");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setQuantity("");
    setSelectedTargetId("");
    setNotes("");
  };

  const renderTargetDropdown = () => {
    const targets = targetType === "assignment" ? assignments 
      : targetType === "task_force" ? taskForces 
      : volunteers;

    const getLabel = (t: AllocationTarget) => {
      if (targetType === "assignment") return t.task || "Assignment";
      if (targetType === "task_force") return t.name || "Task Force";
      return t.name || "Volunteer";
    };

    return (
      <select
        value={selectedTargetId}
        onChange={(e) => setSelectedTargetId(e.target.value)}
        className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4"
      >
        <option value="">Select {targetType.replace("_", " ")}...</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {getLabel(t)}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-2 w-full max-w-md clip-path-tactical">
        <div className="border-b-2 border-orange px-4 py-3">
          <div className="flex justify-between items-center">
            <h2 className="font-display font-semibold text-lg text-orange uppercase tracking-wider">
              ALLOCATE RESOURCE
            </h2>
            <button onClick={onClose} className="text-muted hover:text-ink text-xl">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <InputField
            label="Quantity *"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            min="1"
            required
          />

          <div>
            <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] mb-2 block">
              ALLOCATE TO *
            </label>
            <div className="flex gap-2 mb-3">
              {(["assignment", "task_force", "volunteer"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setTargetType(type);
                    setSelectedTargetId("");
                  }}
                  className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                    targetType === type
                      ? "bg-orange text-black border-orange"
                      : "bg-transparent text-muted border-border-dim hover:border-orange"
                  }`}
                >
                  {type === "task_force" ? "TASK FORCE" : type.toUpperCase()}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="text-muted font-mono text-xs">Loading...</div>
            ) : (
              renderTargetDropdown()
            )}
          </div>

          <div>
            <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] mb-1 block">
              NOTES
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery details, special instructions..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 resize-none"
            />
          </div>

          {error && (
            <p className="text-alert font-mono text-xs">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              CANCEL
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "ALLOCATING..." : "CONFIRM ALLOCATE"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
