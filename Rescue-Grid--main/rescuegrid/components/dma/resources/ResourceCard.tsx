"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { formatRelative, useNow } from "@/hooks/useNow";

export interface ResourceWithAllocation {
  id: string;
  name: string;
  type: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string | null;
  owner_info: string | null;
  location: string | null;
  updated_at: string;
  quantity_allocated?: number;
  quantity_available?: number;
}

interface ResourceCardProps {
  resource: ResourceWithAllocation;
  onAllocate: (id: string) => void;
  onViewAllocations: (id: string) => void;
  onChanged: () => void;
}

export default function ResourceCard({ resource, onAllocate, onViewAllocations, onChanged }: ResourceCardProps) {
  const now = useNow(60000);
  const [editingQty, setEditingQty] = useState(false);
  const [newQty, setNewQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = resource.quantity;
  const allocated = resource.quantity_allocated || 0;
  const available = resource.quantity_available ?? total - allocated;
  const percentage = total > 0 ? (available / total) * 100 : 0;
  const unit = resource.unit || "units";

  const isOutOfStock = available <= 0;
  const isLowStock = isOutOfStock || available <= resource.low_stock_threshold;

  const barColor = isOutOfStock || percentage < 30 ? "bg-alert" : percentage < 60 ? "bg-caution" : "bg-ops";

  const startEditing = () => {
    setNewQty(String(total));
    setError("");
    setEditingQty(true);
  };

  const handleSave = async () => {
    const qty = Number(newQty);
    if (!Number.isFinite(qty) || qty < 0) {
      setError("Enter a valid quantity");
      return;
    }
    if (qty < allocated) {
      setError(`Can't be less than the ${allocated} currently allocated`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dma/resource/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update");
      }
      setEditingQty(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete resource "${resource.name}"? This action cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dma/resource/${resource.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete resource");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resource");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 p-4 clip-path-tactical relative">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-inter font-semibold text-ink text-base uppercase tracking-wide">{resource.name}</h3>
          <p className="font-ibm-mono text-[10px] text-muted uppercase tracking-wider mt-0.5">Type: {resource.type || "N/A"}</p>
        </div>
        {isLowStock && (
          <span className={`px-2 py-0.5 font-ibm-mono text-[10px] uppercase ${isOutOfStock ? "bg-alert/15 text-alert" : "bg-caution/20 text-caution"}`}>
            {isOutOfStock ? "OUT OF STOCK" : "LOW STOCK"}
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[11px] font-ibm-mono mb-1">
          <span className="text-muted">AVAILABLE / TOTAL</span>
          <span className="text-ink">{available.toLocaleString()} / {total.toLocaleString()} {unit}</span>
        </div>
        <div className="h-2 bg-surface-3 rounded-sm overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${Math.max(percentage, 2)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-ibm-mono mt-1 text-dim">
          <span>Allocated: {allocated.toLocaleString()}</span>
          <span>Low at: {resource.low_stock_threshold.toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-1.5 text-[10px] font-inter text-dim mb-4">
        {resource.location && (
          <div className="flex items-center gap-2">
            <span className="text-orange">Location:</span>
            <span className="text-muted">{resource.location}</span>
          </div>
        )}
        {resource.owner_info && (
          <div className="flex items-center gap-2">
            <span className="text-orange">Owner:</span>
            <span className="text-muted">{resource.owner_info}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-orange">Updated:</span>
          <span className="text-muted">{formatRelative(resource.updated_at, now)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {editingQty ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSave()}
              className="w-20 px-2 py-1 bg-surface-3 border border-border text-ink font-ibm-mono text-xs"
              min={allocated}
              aria-label="Total quantity"
              autoFocus
            />
            <Button size="small" onClick={handleSave} disabled={saving}>{saving ? "..." : "SAVE"}</Button>
            <Button size="small" variant="ghost" onClick={() => setEditingQty(false)}>✕</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="small" variant="ghost" onClick={startEditing}>EDIT QTY</Button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-2 py-1 text-[10px] font-ibm-mono text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors uppercase tracking-wider"
            >
              DELETE
            </button>
          </div>
        )}

        {!editingQty && (
          <Button size="small" variant="primary" onClick={() => onAllocate(resource.id)} disabled={isOutOfStock}>
            ALLOCATE
          </Button>
        )}
      </div>

      {error && <p className="mt-2 font-ibm-mono text-[10px] text-alert" role="alert">{error}</p>}

      <button
        onClick={() => onViewAllocations(resource.id)}
        className="mt-3 w-full text-center text-[10px] font-ibm-mono text-orange hover:text-orange/80 uppercase tracking-wider py-1 border-t border-border-dim pt-2"
      >
        VIEW ALLOCATIONS →
      </button>
    </div>
  );
}
