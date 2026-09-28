"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import LeftSidebar, { type DashboardResource } from "@/components/dma/LeftSidebar";
import RightSidebar from "@/components/dma/RightSidebar";

// The map library is large: load it separately so the side panels and
// counters appear straight away.
const MapboxMap = dynamic(() => import("@/components/dma/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
      <span className="font-mono text-[11px] text-dim uppercase tracking-wider">Loading map…</span>
    </div>
  ),
});
import CreateAssignmentModal from "@/components/dma/CreateAssignmentModal";
import { useNeeds, VictimReport } from "@/hooks/useNeeds";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { DEFAULT_MAP_CENTER } from "@/lib/config";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dmaLocation, setDmaLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [filters, setFilters] = useState({
    situations: [] as string[],
    urgencies: [] as string[],
    district: "",
  });

  const [layers, setLayers] = useState({
    needPins: true,
    volunteers: true,
    taskForceRoutes: true,
    reliefCamps: false,
    hospitals: false,
  });

  const [resources, setResources] = useState<DashboardResource[]>([]);
  const { needs: reports } = useNeeds();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalReportId, setCreateModalReportId] = useState<string | null>(null);

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null;
  const districts = useMemo(
    () => [...new Set(reports.map((r) => r.district?.trim()).filter((d): d is string => !!d))].sort(),
    [reports]
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setDmaLocation(DEFAULT_MAP_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setDmaLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setDmaLocation(DEFAULT_MAP_CENTER),
      { timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  // "+ CREATE TASK" in the top bar links here with ?create=true — latch it into
  // state (adjusting state during render), then clean the URL.
  const wantsCreate = searchParams.get("create") === "true";
  const [handledCreate, setHandledCreate] = useState(false);
  if (wantsCreate && !handledCreate) {
    setHandledCreate(true);
    setCreateModalReportId(null);
    setShowCreateModal(true);
  } else if (!wantsCreate && handledCreate) {
    setHandledCreate(false);
  }
  useEffect(() => {
    if (wantsCreate) router.replace("/dma/dashboard");
  }, [wantsCreate, router]);
  const modalOpen = showCreateModal;

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/resource/list-with-allocations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setResources(data);
      }
    } catch {
      // keep last known inventory
    }
  }, []);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  const scheduleResourceRefresh = useDebouncedCallback(() => void fetchResources(), 500);
  useRealtimeSubscription([
    { table: "resource", onInsert: scheduleResourceRefresh, onUpdate: scheduleResourceRefresh, onDelete: scheduleResourceRefresh },
    { table: "resource_allocation", onInsert: scheduleResourceRefresh, onUpdate: scheduleResourceRefresh, onDelete: scheduleResourceRefresh },
  ]);

  const handleLayerToggle = useCallback((layer: string, enabled: boolean) => {
    setLayers((prev) => ({ ...prev, [layer]: enabled }));
  }, []);

  const handleResourceUpdate = useCallback(async (id: string, quantity: number) => {
    try {
      const res = await fetch(`/api/dma/resource/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not update quantity");
        return;
      }
      void fetchResources();
    } catch {
      window.alert("Network error — quantity not saved");
    }
  }, [fetchResources]);

  const handleReportSelect = useCallback((report: VictimReport | null) => {
    setSelectedReportId(report?.id || null);
  }, []);

  const handleCreateAssignment = useCallback((reportId: string) => {
    setCreateModalReportId(reportId);
    setShowCreateModal(true);
  }, []);

  const handleResolveReport = useCallback(async (reportId: string) => {
    if (!window.confirm("Resolve this report? Any open missions for it will be closed.")) return;
    try {
      const res = await fetch("/api/dma/report/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId }),
      });
      if (!res.ok) throw new Error("Failed to resolve report");
      setSelectedReportId(null);
    } catch {
      window.alert("Could not resolve the report. Please try again.");
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
      {/* Desktop: filters | map | details. Narrow screens: map, details, filters stacked and scrollable. */}
      <div className="flex flex-col lg:flex-row flex-1 mt-[52px] overflow-y-auto lg:overflow-hidden">
        <LeftSidebar
          filters={filters}
          onFiltersChange={setFilters}
          onLayerToggle={handleLayerToggle}
          layers={layers}
          resources={resources}
          onResourceUpdate={handleResourceUpdate}
          districts={districts}
        />

        <main className="relative h-[55vh] flex-none lg:h-auto lg:flex-1 order-1 lg:order-2">
          <MapboxMap
            reports={reports}
            filters={filters}
            layers={layers}
            onReportSelect={handleReportSelect}
            selectedReportId={selectedReportId}
            dmaLocation={dmaLocation}
          />
        </main>

        <RightSidebar
          selectedReport={selectedReport}
          onCreateAssignment={handleCreateAssignment}
          onResolveReport={handleResolveReport}
        />
      </div>

      {modalOpen && (
        <CreateAssignmentModal
          linkedReportId={createModalReportId}
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalReportId(null);
          }}
        />
      )}
    </div>
  );
}

export default function DmaDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <span className="font-mono text-[11px] text-dim uppercase tracking-wider">LOADING...</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
