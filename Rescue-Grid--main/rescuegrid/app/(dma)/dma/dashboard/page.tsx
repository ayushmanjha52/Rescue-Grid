"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LeftSidebar from "@/components/dma/LeftSidebar";
import RightSidebar from "@/components/dma/RightSidebar";
import MapboxMap from "@/components/dma/MapboxMap";
import CreateAssignmentModal from "@/components/dma/CreateAssignmentModal";
import { useAIAssistant } from "@/components/dma/AIAssistantProvider";
import { useNeeds, VictimReport } from "@/hooks/useNeeds";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { createClient } from "@/lib/supabase/client";

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

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authLoading, setAuthLoading] = useState(true);
  const [dmaLocation, setDmaLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { open: openAI, toggle: toggleAI } = useAIAssistant();

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

  const [resources, setResources] = useState<Resource[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const { needs: reports, loading: reportsLoading } = useNeeds();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalReportId, setCreateModalReportId] = useState<string | null>(null);

  const selectedReport = reports.find(r => r.id === selectedReportId) || null;

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDmaLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setDmaLocation({ lat: 23.79, lng: 86.43 });
        }
      );
    } else {
      setDmaLocation({ lat: 23.79, lng: 86.43 });
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreateModal(true);
      router.replace("/dma/dashboard");
    }
  }, [searchParams, router]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        router.push("/dma/login");
        return;
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch("/api/dma/resource/list");
        if (res.ok) {
          const data = await res.json();
          setResources(data);
        }
      } catch {
        // silent fail
      }
    };

    fetchResources();
  }, []);

  useEffect(() => {
    if (reports.length > 0) {
      const uniqueDistricts = [...new Set(reports.map((r) => r.district).filter(Boolean))] as string[];
      setDistricts(uniqueDistricts);
    }
  }, [reports]);

  useKeyboardShortcut('k', () => toggleAI(), { ctrl: true });

  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
  }, []);

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
      if (res.ok) {
        setResources((prev) =>
          prev.map((r) => (r.id === id ? { ...r, quantity } : r))
        );
      }
    } catch {
      // silent fail
    }
  }, []);

  const handleReportSelect = useCallback((report: VictimReport | null) => {
    setSelectedReportId(report?.id || null);
  }, []);

  const handleCreateAssignment = useCallback((reportId: string) => {
    setCreateModalReportId(reportId);
    setShowCreateModal(true);
  }, []);

  const handleResolveReport = useCallback(async (reportId: string) => {
    try {
      const res = await fetch('/api/dma/report/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to resolve report');
      }
      
      // Deselect the report to "remove" it from active focus
      setSelectedReportId(null);
    } catch (error) {
      console.error("Error resolving report:", error);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <span className="font-mono text-[11px] text-dim uppercase tracking-wider">
          AUTHENTICATING...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
      <div className="flex flex-1 mt-[52px] overflow-hidden">
        <LeftSidebar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onLayerToggle={handleLayerToggle}
          layers={layers}
          resources={resources}
          onResourceUpdate={handleResourceUpdate}
          districts={districts}
        />

        <main className="flex-1 relative">
          <MapboxMap
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

      {showCreateModal && (
        <CreateAssignmentModal
          linkedReportId={createModalReportId}
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalReportId(null);
          }}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}

export default function DmaDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <span className="font-mono text-[11px] text-dim uppercase tracking-wider">
          LOADING...
        </span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}