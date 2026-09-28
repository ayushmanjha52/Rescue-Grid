"use client";

import { useState, useEffect, useCallback } from "react";
import ResourceCard, { type ResourceWithAllocation } from "@/components/dma/resources/ResourceCard";
import CreateResourceModal from "@/components/dma/resources/CreateResourceModal";
import AllocateResourceModal from "@/components/dma/resources/AllocateResourceModal";
import ResourceAllocationList from "@/components/dma/resources/ResourceAllocationList";
import Button from "@/components/ui/Button";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceWithAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inventory" | "allocations">("inventory");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [allocateResource, setAllocateResource] = useState<ResourceWithAllocation | null>(null);
  const [allocationFilterId, setAllocationFilterId] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const loadResources = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/resource/list-with-allocations", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setResources(data);
    } catch {
      // keep last inventory
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  // Any stock or allocation change → one debounced reload (keeps available/allocated correct).
  const scheduleReload = useDebouncedCallback(() => void loadResources(), 300);
  useRealtimeSubscription([
    { table: "resource", onInsert: scheduleReload, onUpdate: scheduleReload, onDelete: scheduleReload },
    { table: "resource_allocation", onInsert: scheduleReload, onUpdate: scheduleReload, onDelete: scheduleReload },
  ]);

  const query = search.trim().toLowerCase();
  const visibleResources = resources.filter(
    (r) => !query || r.name.toLowerCase().includes(query) || (r.type || "").toLowerCase().includes(query) || (r.location || "").toLowerCase().includes(query)
  );
  const lowStockCount = resources.filter((r) => (r.quantity_available ?? r.quantity) <= r.low_stock_threshold).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-[52px]">
        <div className="border-b border-gray-200 bg-white">
          <div className="px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h1 className="font-inter font-bold text-xl text-gray-900 uppercase tracking-wider">RESOURCES</h1>
              <p className="font-ibm-mono text-[10px] text-gray-500 uppercase tracking-wider">
                {resources.length} items{lowStockCount > 0 && <span className="text-alert"> · {lowStockCount} low stock</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {activeTab === "inventory" && (
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inventory..."
                  aria-label="Search inventory"
                  className="flex-1 min-w-0 sm:flex-none sm:w-56 px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm font-inter text-sm focus:outline-none focus:border-orange"
                />
              )}
              <Button onClick={() => setShowCreateModal(true)} className="shrink-0">+ ADD RESOURCE</Button>
            </div>
          </div>

          <div className="flex px-6" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "inventory"}
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-2 font-inter text-xs uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === "inventory" ? "text-orange border-orange" : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              INVENTORY
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "allocations"}
              onClick={() => {
                setActiveTab("allocations");
                setAllocationFilterId(undefined);
              }}
              className={`px-4 py-2 font-inter text-xs uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === "allocations" ? "text-orange border-orange" : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              ALLOCATIONS
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "inventory" ? (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-56 bg-white animate-pulse" />)}
              </div>
            ) : visibleResources.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-inter text-gray-500 text-sm uppercase tracking-wider">
                  {resources.length === 0 ? "NO RESOURCES LOGGED" : "NO RESOURCES MATCH YOUR SEARCH"}
                </p>
                {resources.length === 0 && (
                  <p className="font-ibm-mono text-gray-500 text-xs mt-2">Click &quot;+ ADD RESOURCE&quot; to add your first resource</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onAllocate={() => setAllocateResource(resource)}
                    onViewAllocations={(id) => {
                      setAllocationFilterId(id);
                      setActiveTab("allocations");
                    }}
                    onChanged={loadResources}
                  />
                ))}
              </div>
            )
          ) : (
            <div>
              {allocationFilterId && (
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-inter text-xs text-gray-600">
                    Showing allocations for <strong>{resources.find((r) => r.id === allocationFilterId)?.name || "resource"}</strong>
                  </span>
                  <button onClick={() => setAllocationFilterId(undefined)} className="text-orange font-inter text-xs hover:underline">
                    ← Show all
                  </button>
                </div>
              )}
              <ResourceAllocationList filterResourceId={allocationFilterId} />
            </div>
          )}
        </div>

        <CreateResourceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={loadResources} />

        {allocateResource && (
          <AllocateResourceModal
            isOpen
            onClose={() => setAllocateResource(null)}
            onAllocated={loadResources}
            resource={allocateResource}
          />
        )}
      </div>
    </div>
  );
}
