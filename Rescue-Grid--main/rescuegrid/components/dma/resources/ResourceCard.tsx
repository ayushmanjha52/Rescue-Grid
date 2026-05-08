"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface ResourceWithAllocation {
  id: string;
  name: string;
  type: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
  owner_info: string;
  location: string;
  updated_at: string;
  quantity_allocated?: number;
  quantity_available?: number;
}

interface ResourceCardProps {
  resource: ResourceWithAllocation;
  onEdit: (id: string) => void;
  onAllocate: (id: string) => void;
  onViewAllocations: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ResourceCard({ resource, onEdit, onAllocate, onViewAllocations, onDelete }: ResourceCardProps) {
  const [editingQty, setEditingQty] = useState(false);
  const [newQty, setNewQty] = useState(resource.quantity.toString());
  const [saving, setSaving] = useState(false);

  const total = resource.quantity;
  const allocated = resource.quantity_allocated || 0;
  const available = total - allocated;
  const percentage = total > 0 ? (available / total) * 100 : 0;

  const isLowStock = available < resource.low_stock_threshold || available <= 0;
  const isOutOfStock = available <= 0;

  const getBarColor = () => {
    if (isOutOfStock) return "bg-alert";
    if (percentage < 30) return "bg-alert";
    if (percentage < 60) return "bg-caution";
    return "bg-ops";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/dma/resource/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: parseFloat(newQty) || 0 }),
      });
      if (!res.ok) throw new Error("Failed to update");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setEditingQty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete resource "${resource.name}"? This action cannot be undone.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/dma/resource/${resource.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      onDelete(resource.id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete resource");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-2 p-4 clip-path-tactical relative">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-inter font-semibold text-ink text-base uppercase tracking-wide">
            {resource.name}
          </h3>
          <p className="font-ibm-mono text-[10px] text-muted uppercase tracking-wider mt-0.5">
            Type: {resource.type || "N/A"}
          </p>
        </div>
        {isLowStock && (
          <span className="bg-caution/20 text-caution px-2 py-0.5 font-ibm-mono text-[10px] uppercase">
            {isOutOfStock ? "OUT OF STOCK" : "LOW STOCK"}
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[11px] font-ibm-mono mb-1">
          <span className="text-muted">AVAILABLE / TOTAL</span>
          <span className="text-ink">{available.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-surface-3 rounded-sm overflow-hidden">
          <div
            className={`h-full ${getBarColor()} transition-all duration-300`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-ibm-mono mt-1 text-dim">
          <span>Allocated: {allocated.toLocaleString()}</span>
          <span>Available: {available.toLocaleString()}</span>
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
          <span className="text-muted">{formatTime(resource.updated_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {editingQty ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-20 px-2 py-1 bg-surface-3 border border-border text-ink font-ibm-mono text-xs"
              min="0"
            />
            <Button size="small" onClick={handleSave} disabled={saving}>
              {saving ? "..." : "SAVE"}
            </Button>
            <Button size="small" variant="ghost" onClick={() => setEditingQty(false)}>
              CANCEL
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="small" variant="ghost" onClick={() => setEditingQty(true)}>
              EDIT QTY
            </Button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-2 py-1 text-[10px] font-ibm-mono text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors uppercase tracking-wider"
              title="Delete resource"
            >
              DELETE
            </button>
          </div>
        )}

        <Button size="small" variant="primary" onClick={() => onAllocate(resource.id)} disabled={isOutOfStock}>
          ALLOCATE
        </Button>
      </div>

      <button
        onClick={() => onViewAllocations(resource.id)}
        className="mt-3 w-full text-center text-[10px] font-ibm-mono text-orange hover:text-orange/80 uppercase tracking-wider py-1 border-t border-border-dim pt-2"
      >
        VIEW ALLOCATIONS →
      </button>
    </div>
  );
}
