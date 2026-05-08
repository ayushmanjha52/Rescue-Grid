"use client";

import { useState, useCallback } from "react";

const SITUATION_TYPES = [
  { key: "food", label: "Food", color: "bg-green-500" },
  { key: "water", label: "Water", color: "bg-blue-500" },
  { key: "medical", label: "Medical", color: "bg-amber-500" },
  { key: "rescue", label: "Rescue", color: "bg-red-500" },
  { key: "shelter", label: "Shelter", color: "bg-purple-500" },
  { key: "missing", label: "Missing", color: "bg-gray-500" },
];

const URGENCY_LEVELS = ["critical", "urgent", "moderate"] as const;

interface Resource {
  id: string;
  name: string;
  type: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
  location: string;
  updated_at: string;
}

interface LeftSidebarProps {
  filters: {
    situations: string[];
    urgencies: string[];
    district: string;
  };
  onFiltersChange: (filters: { situations: string[]; urgencies: string[]; district: string }) => void;
  onLayerToggle: (layer: string, enabled: boolean) => void;
  layers: Record<string, boolean>;
  resources: Resource[];
  onResourceUpdate: (id: string, quantity: number) => void;
  districts: string[];
}

export default function LeftSidebar({
  filters,
  onFiltersChange,
  onLayerToggle,
  layers,
  resources,
  onResourceUpdate,
  districts,
}: LeftSidebarProps) {
  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const toggleSituation = useCallback(
    (situation: string) => {
      const newSituations = filters.situations.includes(situation)
        ? filters.situations.filter((s) => s !== situation)
        : [...filters.situations, situation];
      onFiltersChange({ ...filters, situations: newSituations });
    },
    [filters, onFiltersChange]
  );

  const toggleUrgency = useCallback(
    (urgency: string) => {
      const newUrgencies = filters.urgencies.includes(urgency)
        ? filters.urgencies.filter((u) => u !== urgency)
        : [...filters.urgencies, urgency];
      onFiltersChange({ ...filters, urgencies: newUrgencies });
    },
    [filters, onFiltersChange]
  );

  const getBarColor = (resource: Resource) => {
    const pct = (resource.quantity / (resource.low_stock_threshold * 2 || 1)) * 100;
    if (resource.quantity < resource.low_stock_threshold) return "bg-red-500";
    if (pct > 60) return "bg-green-500";
    return "bg-amber-500";
  };

  const getBarPercent = (resource: Resource) => {
    const max = Math.max(resource.quantity, resource.low_stock_threshold * 2);
    return Math.min(100, (resource.quantity / max) * 100);
  };

  const handleEditStart = (resource: Resource) => {
    setEditingResource(resource.id);
    setEditValue(resource.quantity.toString());
  };

  const handleEditSave = (id: string) => {
    const qty = parseFloat(editValue);
    if (!isNaN(qty) && qty >= 0) {
      onResourceUpdate(id, qty);
    }
    setEditingResource(null);
    setEditValue("");
  };

  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-border-dim overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-6">
        <section>
          <h3 className="font-inter text-[11px] font-semibold text-dim uppercase tracking-[0.15em] mb-3">
            FILTER BY NEED TYPE
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SITUATION_TYPES.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSituation(s.key)}
                className={`
                  px-3 py-2 text-left font-inter text-[13px] font-semibold uppercase tracking-wide
                  border-l-[3px] transition-all text-ink
                  ${
                    filters.situations.includes(s.key)
                      ? "bg-orange-50 border-orange"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                  }
                `}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-inter text-[11px] font-semibold text-dim uppercase tracking-[0.15em] mb-3">
            URGENCY LEVEL
          </h3>
          <div className="space-y-2">
            {URGENCY_LEVELS.map((u) => (
              <button
                key={u}
                onClick={() => toggleUrgency(u)}
                className={`
                  w-full flex items-center gap-2 px-2 py-2 font-inter text-[13px] font-semibold uppercase
                  transition-all
                  ${
                    filters.urgencies.includes(u)
                      ? "text-orange"
                      : "text-dim hover:text-ink"
                  }
                `}
              >
                <span
                  className={`
                    w-3 h-3 rounded-full border transition-all flex items-center justify-center
                    ${filters.urgencies.includes(u) ? "bg-orange border-orange" : "border-gray-300"}
                  `}
                >
                  {filters.urgencies.includes(u) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
                {u}
              </button>
            ))}
          </div>
        </section>

        {districts.length > 0 && (
          <section>
          <h3 className="font-mono text-[11px] font-semibold text-dim uppercase tracking-[0.15em] mb-3">
            DISTRICT FILTER
          </h3>
            <select
              value={filters.district}
              onChange={(e) => onFiltersChange({ ...filters, district: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-inter text-[14px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </section>
        )}

        <section>
          <h3 className="font-inter text-[11px] font-semibold text-dim uppercase tracking-[0.15em] mb-3">
            MAP LAYERS
          </h3>
          <div className="space-y-2">
            {[
              { key: "needPins", label: "Need Pins" },
              { key: "volunteers", label: "Volunteer Locations" },
              { key: "taskForceRoutes", label: "Task Force Routes" },
              { key: "reliefCamps", label: "Relief Camps" },
              { key: "hospitals", label: "Nearby Hospitals" },
            ].map((layer) => (
              <label
                key={layer.key}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={layers[layer.key]}
                  onClick={() => onLayerToggle(layer.key, !layers[layer.key])}
                  className={`
                    w-10 h-5 rounded-full transition-all relative
                    ${layers[layer.key] ? "bg-orange" : "bg-gray-200"}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm
                      ${layers[layer.key] ? "left-5" : "left-0.5"}
                    `}
                  />
                </button>
                <span className={`font-inter text-[12px] font-medium uppercase tracking-wide transition-colors ${layers[layer.key] ? "text-ink" : "text-dim group-hover:text-muted"}`}>
                  {layer.label}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-inter text-[11px] font-semibold text-dim uppercase tracking-[0.15em] mb-3">
            RESOURCE SUMMARY
          </h3>
          <div className="space-y-4">
            {resources.map((r) => {
              const isLow = r.quantity < r.low_stock_threshold;
              const barPercent = getBarPercent(r);
              const barColor = getBarColor(r);

              return (
                <div key={r.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-inter text-[14px] font-semibold text-ink">
                      {r.name}
                    </span>
                    {isLow && (
                      <span className="font-ibm-mono text-[10px] font-semibold text-red-600 uppercase tracking-wider px-2 py-1 bg-red-50 rounded-sm">
                        LOW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    {editingResource === r.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleEditSave(r.id)}
                        onKeyDown={(e) => e.key === "Enter" && handleEditSave(r.id)}
                        autoFocus
                        className="w-16 px-2 py-0.5 bg-white border border-orange rounded-sm font-ibm-mono text-[12px] text-ink focus:outline-none focus:ring-2 focus:ring-orange/20"
                      />
                    ) : (
                      <button
                        onClick={() => handleEditStart(r)}
                        className="font-ibm-mono text-[13px] font-medium text-ink hover:text-orange transition-colors"
                      >
                        {r.quantity} / {r.low_stock_threshold * 2} {r.unit}
                      </button>
                    )}
                  </div>
                  <div className="h-[3px] bg-gray-100 w-full rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all rounded-full`}
                      style={{ width: `${barPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
