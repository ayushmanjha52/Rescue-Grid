"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl, ScaleControl, Source, Layer, type MapRef } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
import { VolunteerMapLayer } from "./VolunteerMapLayer";
import type { VictimReport } from "@/hooks/useNeeds";
import { useVolunteers, Volunteer } from "@/hooks/useVolunteers";
import { useAssignments } from "@/hooks/useAssignments";
import { useTaskForceMemberLocations } from "@/hooks/useTaskForceMemberLocations";
import { formatRelative, useNow } from "@/hooks/useNow";
import { DEFAULT_MAP_CENTER, MAPBOX_TOKEN } from "@/lib/config";
import { isAssignmentDone, SITUATION_COLORS } from "@/lib/status";
import { parseList } from "@/lib/skills";

const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
};
type MapStyle = keyof typeof MAP_STYLES;

// The style button cycles dark → satellite → streets and names the next one.
const NEXT_MAP_STYLE: Record<MapStyle, MapStyle> = { dark: "satellite", satellite: "streets", streets: "dark" };
const MAP_STYLE_LABELS: Record<MapStyle, string> = { dark: "🌙 NIGHT", satellite: "🛰️ SATELLITE", streets: "🗺️ STREETS" };

const SITUATION_STYLES: Record<string, { color: string; label: string }> = {
  rescue: { color: SITUATION_COLORS.rescue, label: "RESCUE" },
  food: { color: SITUATION_COLORS.food, label: "FOOD" },
  water: { color: SITUATION_COLORS.water, label: "WATER" },
  medical: { color: SITUATION_COLORS.medical, label: "MEDICAL" },
  shelter: { color: SITUATION_COLORS.shelter, label: "SHELTER" },
  missing: { color: SITUATION_COLORS.missing, label: "MISSING" },
};

const STATUS_COLORS: Record<string, string> = {
  open: "#4ADE94",
  verified: "#7CB2FF",
  assigned: "#7CB2FF",
  en_route: "#FF7A3D",
  arrived: "#4ADE94",
  resolved: "#A8A29A",
  duplicate: "#F7B955",
};

interface POIPlace {
  id: string;
  name: string;
  category: "hospital" | "reliefCamp";
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapboxMapProps {
  reports: VictimReport[];
  filters: {
    situations: string[];
    urgencies: string[];
    district: string;
  };
  layers: Record<string, boolean>;
  onReportSelect: (report: VictimReport | null) => void;
  selectedReportId: string | null;
  dmaLocation: { lat: number; lng: number } | null;
}

type LineGeometry = GeoJSON.LineString;

type LocatedReport = VictimReport & { latitude: number; longitude: number };

function hasCoordinates(report: VictimReport): report is LocatedReport {
  return report.latitude != null && report.longitude != null;
}

function getVolunteerStatusColor(status: string): string {
  if (status === "on-mission") return "#FF7A3D";
  if (status === "standby") return "#F7B955";
  return "#4ADE94";
}

function getVolunteerStatusLabel(status: string): string {
  if (status === "on-mission") return "ON MISSION";
  if (status === "standby") return "STANDBY";
  if (status === "active") return "READY";
  return "OFFLINE";
}

/** Rounds coordinates so a route is re-fetched only after ~1km of movement. */
function routeKey(prefix: string, fromLng: number, fromLat: number, toId: string) {
  return `${prefix}:${fromLng.toFixed(2)},${fromLat.toFixed(2)}->${toId}`;
}

async function fetchDirections(fromLng: number, fromLat: number, toLng: number, toLat: number) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.routes?.[0] ?? null;
}

function VictimMarker({
  report,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  report: VictimReport;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const style = SITUATION_STYLES[report.situation] || SITUATION_STYLES.rescue;
  const isCritical = report.status === "open" && report.urgency === "critical";
  const statusColor = STATUS_COLORS[report.status] || style.color;
  const isAssigned = report.status === "assigned" || report.status === "en_route" || report.status === "arrived";

  return (
    <div
      className="relative cursor-pointer group"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      aria-label={`${style.label} report, ${report.urgency}, ${report.status}`}
    >
      {isCritical && (
        <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: style.color }} />
      )}
      {isAssigned && (
        <div
          className="absolute -inset-2 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite]"
          style={{ borderColor: "#FF7A3D" }}
        />
      )}
      <div
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${isSelected ? "scale-125 z-50" : ""}`}
        style={{ backgroundColor: style.color, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
      >
        <MapPin className="w-5 h-5 text-on-accent" />
        <div
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]"
          style={{ borderTopColor: style.color }}
        />
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-1"
          style={{ backgroundColor: statusColor }}
        />
      </div>
      {isSelected && <div className="absolute -inset-1 border-2 border-white rounded-full" />}
    </div>
  );
}

function POIMarker({
  poi,
  onMouseEnter,
  onMouseLeave,
}: {
  poi: POIPlace;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const isHospital = poi.category === "hospital";
  const color = isHospital ? "#7CB2FF" : "#4ADE94";

  return (
    <div className="relative cursor-pointer group" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="relative w-8 h-10 transition-transform group-hover:scale-110" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
        <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M16 2C8.268 2 2 8.268 2 16C2 24 16 38 16 38C16 38 30 24 30 16C30 8.268 23.732 2 16 2Z" fill={color} stroke="white" strokeWidth="2" />
          {isHospital ? (
            <>
              <rect x="13" y="10" width="6" height="12" fill="white" rx="1" />
              <rect x="10" y="13" width="12" height="6" fill="white" rx="1" />
            </>
          ) : (
            <>
              <path d="M16 12L16 24M12 16L20 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="10" y="26" width="12" height="4" fill="white" rx="1" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

function ReportPopup({ report, isOrigin, now }: { report: VictimReport; isOrigin?: boolean; now: number }) {
  const style = SITUATION_STYLES[report.situation] || SITUATION_STYLES.rescue;
  const urgencyColor = report.urgency === "critical" ? "#FF6166" : report.urgency === "urgent" ? "#FF7A3D" : "#9A948B";
  const statusColor = STATUS_COLORS[report.status] || "#A8A29A";

  return (
    <div style={{ background: "#121215", minWidth: 260, borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
      {isOrigin && (
        <div style={{ background: "#FF7A3D", padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "#0B0B0D", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          📍 Origin Selected
        </div>
      )}
      <div style={{ borderLeft: `3px solid ${style.color}`, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: style.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>{style.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: urgencyColor, background: `${urgencyColor}20`, padding: "3px 6px", borderRadius: 2, textTransform: "uppercase" }}>{report.urgency}</span>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "#F2EEE7", marginBottom: 4 }}>
          📍 {report.city || "Unknown"}{report.district ? `, ${report.district.trim()}` : ""}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A948B", marginBottom: report.custom_message ? 8 : 0 }}>
          {report.phone_no} · {formatRelative(report.created_at, now)}
        </div>
        {report.custom_message && (
          <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#BDB6AC", fontStyle: "italic", lineHeight: 1.4, padding: 8, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginBottom: 8 }}>
            &ldquo;{report.custom_message.substring(0, 80)}{report.custom_message.length > 80 ? "..." : ""}&rdquo;
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: statusColor }}>● {report.status?.toUpperCase().replace("_", " ") || "OPEN"}</span>
          {isOrigin && (
            <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "#FF7A3D", textTransform: "uppercase" }}>Click responder to measure →</span>
          )}
        </div>
      </div>
    </div>
  );
}

function VolunteerPopup({ vol, isDestination, distanceInfo, now }: { vol: Volunteer; isDestination?: boolean; distanceInfo?: { distance: string; duration: string }; now: number }) {
  const statusColor = getVolunteerStatusColor(vol.status);
  const skills = parseList(vol.skills);
  const equipment = parseList(vol.equipment);

  return (
    <div style={{ background: "#121215", minWidth: 240, borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
      {isDestination && (
        <div style={{ background: "#4ADE94", padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "#0B0B0D", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ✓ Destination Set
        </div>
      )}
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, background: "#202026", border: `2px solid ${statusColor}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#F2EEE7" }}>
            {vol.name?.charAt(0) || "?"}
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "#F2EEE7" }}>{vol.name || "Unknown"}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A948B", textTransform: "uppercase" }}>{vol.type}</div>
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: statusColor, textTransform: "uppercase", background: `${statusColor}15`, padding: "5px 10px", borderRadius: 3, display: "inline-block", marginBottom: 12 }}>
          {getVolunteerStatusLabel(vol.status)}
        </div>
        {skills.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9A948B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {skills.map((skill) => (
                <span key={skill} style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#F2EEE7", background: "rgba(255,122,61,0.1)", border: "1px solid rgba(255,122,61,0.2)", padding: "3px 8px", borderRadius: 2 }}>{skill}</span>
              ))}
            </div>
          </div>
        )}
        {equipment.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9A948B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Equipment</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {equipment.map((eq) => (
                <span key={eq} style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#F2EEE7", background: "rgba(124,178,255,0.1)", border: "1px solid rgba(124,178,255,0.2)", padding: "3px 8px", borderRadius: 2 }}>{eq}</span>
              ))}
            </div>
          </div>
        )}
        {distanceInfo && (
          <div style={{ background: "linear-gradient(135deg,rgba(74,222,148,0.15),rgba(74,222,148,0.05))", border: "1px solid rgba(74,222,148,0.3)", borderRadius: 4, padding: 12, marginTop: 10 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#4ADE94", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Route Info</div>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#4ADE94" }}>{distanceInfo.distance}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9A948B", textTransform: "uppercase" }}>Distance</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#F2EEE7" }}>{distanceInfo.duration}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9A948B", textTransform: "uppercase" }}>Est. Time</div>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {vol.mobile_no && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A948B" }}>📞 {vol.mobile_no}</span>}
          {vol.tier && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A948B" }}>Tier {vol.tier}</span>}
          {vol.last_seen && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A948B" }}>👁 {formatRelative(vol.last_seen, now)}</span>}
        </div>
      </div>
    </div>
  );
}

function PoiPopup({ poi }: { poi: POIPlace }) {
  return (
    <div style={{ background: "#121215", minWidth: 200, borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", borderLeft: `3px solid ${poi.category === "hospital" ? "#7CB2FF" : "#4ADE94"}` }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "#F2EEE7", marginBottom: 4 }}>{poi.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9A948B", textTransform: "uppercase", marginBottom: 4 }}>{poi.category === "hospital" ? "Hospital" : "Shelter / relief"}</div>
        {poi.address && <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#BDB6AC" }}>{poi.address}</div>}
      </div>
    </div>
  );
}

export default function MapboxMap({ reports, filters, layers, onReportSelect, selectedReportId, dmaLocation }: MapboxMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const now = useNow(60000);
  const [viewport, setViewport] = useState<{ bbox?: string; zoom: number }>({ zoom: 10 });
  const { volunteers } = useVolunteers({ bbox: viewport.bbox, zoom: viewport.zoom });
  const { assignments } = useAssignments("dma");
  const { members: taskForceMembers } = useTaskForceMemberLocations();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");
  const [originReport, setOriginReport] = useState<LocatedReport | null>(null);
  const [destinationVolunteer, setDestinationVolunteer] = useState<Volunteer | null>(null);
  const [measureRoute, setMeasureRoute] = useState<{ geometry: LineGeometry; distance: string; duration: string } | null>(null);
  const [poiData, setPoiData] = useState<{ hospitals: POIPlace[]; reliefCamps: POIPlace[] }>({ hospitals: [], reliefCamps: [] });
  const [routeGeometries, setRouteGeometries] = useState<Record<string, LineGeometry>>({});
  const inFlightRoutes = useRef(new Set<string>());

  const [hovered, setHovered] = useState<
    { kind: "report"; report: LocatedReport } | { kind: "volunteer"; volunteer: Volunteer } | { kind: "poi"; poi: POIPlace } | null
  >(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locatedReports = useMemo(() => reports.filter(hasCoordinates), [reports]);

  const filteredReports = useMemo(
    () =>
      locatedReports.filter((r) => {
        if (r.status === "resolved" || r.status === "duplicate") return false;
        if (filters.situations.length > 0 && !filters.situations.includes(r.situation)) return false;
        if (filters.urgencies.length > 0 && !filters.urgencies.includes(r.urgency)) return false;
        if (filters.district && r.district?.trim() !== filters.district.trim()) return false;
        return true;
      }),
    [locatedReports, filters]
  );

  // Pairs of (responder → victim) for every mission still in progress.
  const missionLegs = useMemo(() => {
    const reportsById = new globalThis.Map(locatedReports.map((r) => [r.id, r]));
    const volunteersById = new globalThis.Map(volunteers.map((v) => [v.id, v]));
    const legs: { key: string; assignmentId: string; status: string; type: "volunteer" | "taskforce"; from: [number, number]; to: LocatedReport; memberName?: string }[] = [];

    for (const a of assignments) {
      if (isAssignmentDone(a.status) || !a.victim_report_id) continue;
      const victim = reportsById.get(a.victim_report_id);
      if (!victim) continue;

      if (a.assigned_to_volunteer) {
        const vol = volunteersById.get(a.assigned_to_volunteer);
        if (vol?.latitude != null && vol.longitude != null) {
          legs.push({
            key: routeKey(`vol-${vol.id}`, vol.longitude, vol.latitude, victim.id),
            assignmentId: a.id,
            status: a.status,
            type: "volunteer",
            from: [vol.longitude, vol.latitude],
            to: victim,
          });
        }
      }

      if (a.assigned_to_taskforce && layers.taskForceRoutes) {
        for (const member of taskForceMembers) {
          if (member.task_force_id !== a.assigned_to_taskforce) continue;
          legs.push({
            key: routeKey(`tf-${member.id}`, member.longitude, member.latitude, victim.id),
            assignmentId: a.id,
            status: a.status,
            type: "taskforce",
            from: [member.longitude, member.latitude],
            to: victim,
            memberName: member.name,
          });
        }
      }
    }
    return legs;
  }, [assignments, locatedReports, volunteers, taskForceMembers, layers.taskForceRoutes]);

  // Fetch real road routes for mission legs we haven't routed yet.
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    for (const leg of missionLegs) {
      if (routeGeometries[leg.key] || inFlightRoutes.current.has(leg.key)) continue;
      inFlightRoutes.current.add(leg.key);
      fetchDirections(leg.from[0], leg.from[1], leg.to.longitude, leg.to.latitude)
        .then((route) => {
          if (route) setRouteGeometries((prev) => ({ ...prev, [leg.key]: route.geometry }));
        })
        .catch(() => {})
        .finally(() => inFlightRoutes.current.delete(leg.key));
    }
  }, [missionLegs, routeGeometries]);

  const activeMissionGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: missionLegs.map((leg) => {
      const geometry = routeGeometries[leg.key];
      return {
        type: "Feature" as const,
        geometry: geometry || { type: "LineString" as const, coordinates: [leg.from, [leg.to.longitude, leg.to.latitude]] },
        properties: {
          status: leg.status,
          id: leg.assignmentId,
          type: leg.type,
          memberName: leg.memberName ?? null,
          isRealRoute: !!geometry,
        },
      };
    }),
  }), [missionLegs, routeGeometries]);

  const measureGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: measureRoute ? [{ type: "Feature", properties: {}, geometry: measureRoute.geometry }] : [],
  }), [measureRoute]);

  const fitBoundsToData = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;
    const extend = (lng: number | null | undefined, lat: number | null | undefined) => {
      if (lng == null || lat == null) return;
      bounds.extend([lng, lat]);
      hasPoints = true;
    };

    filteredReports.forEach((r) => extend(r.longitude, r.latitude));
    if (layers.volunteers) volunteers.forEach((v) => extend(v.longitude, v.latitude));
    if (layers.taskForceRoutes) taskForceMembers.forEach((m) => extend(m.longitude, m.latitude));
    measureRoute?.geometry.coordinates.forEach(([lng, lat]) => extend(lng, lat));

    if (hasPoints && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1000, essential: true });
    }
  }, [filteredReports, volunteers, taskForceMembers, measureRoute, layers.volunteers, layers.taskForceRoutes]);

  // Frame the incidents once, when the map and first data are ready.
  const initialBoundsFitted = useRef(false);
  useEffect(() => {
    if (!mapLoaded || initialBoundsFitted.current || filteredReports.length + volunteers.length === 0) return;
    initialBoundsFitted.current = true;
    const id = setTimeout(fitBoundsToData, 300);
    return () => clearTimeout(id);
  }, [mapLoaded, filteredReports.length, volunteers.length, fitBoundsToData]);

  // Nearby hospitals / shelters around the operator (Mapbox POI search).
  useEffect(() => {
    if (!dmaLocation || !MAPBOX_TOKEN) return;
    const controller = new AbortController();
    const { lat, lng } = dmaLocation;

    const search = async (query: string, category: POIPlace["category"]) => {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=poi&proximity=${lng},${lat}&bbox=${lng - 1},${lat - 1},${lng + 1},${lat + 1}&limit=10&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      return (data.features || []).map((feature: { id: string; text?: string; place_name: string; center: [number, number]; properties?: { address?: string } }) => ({
        id: feature.id,
        name: feature.text || feature.place_name,
        category,
        latitude: feature.center[1],
        longitude: feature.center[0],
        address: feature.properties?.address || feature.place_name,
      })) as POIPlace[];
    };

    Promise.all([search("hospital", "hospital"), search("shelter", "reliefCamp")])
      .then(([hospitals, reliefCamps]) => setPoiData({ hospitals, reliefCamps }))
      .catch(() => {});

    return () => controller.abort();
  }, [dmaLocation]);

  useEffect(() => {
    if (!selectedReportId) return;
    const report = locatedReports.find((r) => r.id === selectedReportId);
    if (report) {
      mapRef.current?.flyTo({ center: [report.longitude, report.latitude], zoom: 14, duration: 1000, essential: true });
    }
    // Only fly when the selection changes, not on every report update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId]);

  const clearRouteSelection = useCallback(() => {
    setOriginReport(null);
    setDestinationVolunteer(null);
    setMeasureRoute(null);
  }, []);

  const handleVictimClick = useCallback((report: LocatedReport) => {
    setOriginReport(report);
    setDestinationVolunteer(null);
    setMeasureRoute(null);
    onReportSelect(report);
  }, [onReportSelect]);

  const handleVolunteerClick = useCallback(async (vol: Volunteer) => {
    if (!originReport || !MAPBOX_TOKEN) return;
    setDestinationVolunteer(vol);
    try {
      const route = await fetchDirections(originReport.longitude, originReport.latitude, vol.longitude, vol.latitude);
      if (!route) return;
      const durationMin = Math.round(route.duration / 60);
      setMeasureRoute({
        geometry: route.geometry,
        distance: `${(route.distance / 1000).toFixed(1)} km`,
        duration: durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin} min`,
      });
    } catch {
      // offline — no route
    }
  }, [originReport]);

  const updateViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    setViewport({
      bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
      zoom: Math.round(map.getZoom()),
    });
  }, []);

  const hoverAfterDelay = (next: typeof hovered) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (next) setHovered(next);
    else hoverTimeoutRef.current = setTimeout(() => setHovered(null), 150);
  };

  const popupPosition = hovered
    ? hovered.kind === "report"
      ? { lng: hovered.report.longitude, lat: hovered.report.latitude }
      : hovered.kind === "volunteer"
        ? { lng: hovered.volunteer.longitude, lat: hovered.volunteer.latitude }
        : { lng: hovered.poi.longitude, lat: hovered.poi.latitude }
    : null;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
        <p className="font-mono text-[11px] text-alert">Map unavailable: NEXT_PUBLIC_MAPBOX_TOKEN is not configured.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: DEFAULT_MAP_CENTER.lng, latitude: DEFAULT_MAP_CENTER.lat, zoom: 10 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        onLoad={() => {
          setMapLoaded(true);
          updateViewport();
        }}
        onMoveEnd={updateViewport}
        interactiveLayerIds={layers.volunteers ? ["volunteers-unclustered", "volunteers-clusters"] : undefined}
        onMouseMove={(e) => {
          if (!layers.volunteers) return;
          const feature = e.features?.find((f) => f.layer?.id === "volunteers-unclustered");
          const volunteer = feature?.properties?.id ? volunteers.find((v) => v.id === feature.properties!.id) : undefined;
          if (volunteer) hoverAfterDelay({ kind: "volunteer", volunteer });
          else if (hovered?.kind === "volunteer") hoverAfterDelay(null);
        }}
        onMouseLeave={() => {
          if (hovered?.kind === "volunteer") hoverAfterDelay(null);
        }}
        onClick={(e) => {
          if (!layers.volunteers) return;
          const features = e.features || [];
          const volunteerFeature = features.find((f) => f.layer?.id === "volunteers-unclustered");
          if (volunteerFeature?.properties?.id) {
            const volunteer = volunteers.find((v) => v.id === volunteerFeature.properties!.id);
            if (volunteer) void handleVolunteerClick(volunteer);
            return;
          }
          const clusterFeature = features.find((f) => f.layer?.id === "volunteers-clusters");
          if (clusterFeature?.properties?.cluster_id !== undefined) {
            const coordinates = (clusterFeature.geometry as GeoJSON.Point).coordinates as [number, number];
            const source = mapRef.current?.getMap().getSource("volunteers") as mapboxgl.GeoJSONSource | undefined;
            source?.getClusterExpansionZoom(clusterFeature.properties.cluster_id as number, (err, zoom) => {
              if (!err && zoom != null) mapRef.current?.flyTo({ center: coordinates, zoom: zoom + 0.5, duration: 500 });
            });
          }
        }}
      >
        <NavigationControl position="bottom-right" />
        <ScaleControl />

        {/* Mission routes: casing first so it sits under the orange lines */}
        <Source id="active-missions" type="geojson" data={activeMissionGeoJSON}>
          <Layer id="mission-routes-casing" type="line" paint={{ "line-color": "#000000", "line-width": 5, "line-opacity": 0.25 }} />
          <Layer
            id="mission-routes-temp"
            type="line"
            filter={["!=", ["get", "isRealRoute"], true]}
            paint={{ "line-color": "#FF7A3D", "line-width": 2, "line-dasharray": [4, 3], "line-opacity": 0.5 }}
          />
          <Layer
            id="mission-routes-real"
            type="line"
            filter={["==", ["get", "isRealRoute"], true]}
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "#FF7A3D", "line-width": 3, "line-opacity": 0.85 }}
          />
        </Source>

        {measureRoute && (
          <Source id="measure-route" type="geojson" data={measureGeoJSON}>
            <Layer
              id="measure-route-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#7CB2FF", "line-width": 5, "line-opacity": 0.9 }}
            />
          </Source>
        )}

        {layers.volunteers && <VolunteerMapLayer volunteers={volunteers} />}

        {layers.needPins && filteredReports.map((report) => (
          <Marker key={report.id} longitude={report.longitude} latitude={report.latitude} anchor="bottom">
            <VictimMarker
              report={report}
              isSelected={report.id === selectedReportId}
              onClick={() => handleVictimClick(report)}
              onMouseEnter={() => hoverAfterDelay({ kind: "report", report })}
              onMouseLeave={() => hoverAfterDelay(null)}
            />
          </Marker>
        ))}

        {layers.hospitals && poiData.hospitals.map((poi) => (
          <Marker key={`poi-${poi.id}`} longitude={poi.longitude} latitude={poi.latitude} anchor="bottom">
            <POIMarker poi={poi} onMouseEnter={() => hoverAfterDelay({ kind: "poi", poi })} onMouseLeave={() => hoverAfterDelay(null)} />
          </Marker>
        ))}

        {layers.reliefCamps && poiData.reliefCamps.map((poi) => (
          <Marker key={`poi-${poi.id}`} longitude={poi.longitude} latitude={poi.latitude} anchor="bottom">
            <POIMarker poi={poi} onMouseEnter={() => hoverAfterDelay({ kind: "poi", poi })} onMouseLeave={() => hoverAfterDelay(null)} />
          </Marker>
        ))}

        {hovered && popupPosition && (
          <Popup longitude={popupPosition.lng} latitude={popupPosition.lat} closeButton={false} closeOnClick={false} anchor="bottom" offset={30}>
            <div
              onMouseEnter={() => hoverTimeoutRef.current && clearTimeout(hoverTimeoutRef.current)}
              onMouseLeave={() => hoverAfterDelay(null)}
            >
              {hovered.kind === "report" && <ReportPopup report={hovered.report} isOrigin={originReport?.id === hovered.report.id} now={now} />}
              {hovered.kind === "volunteer" && <VolunteerPopup vol={hovered.volunteer} now={now} />}
              {hovered.kind === "poi" && <PoiPopup poi={hovered.poi} />}
            </div>
          </Popup>
        )}

        {originReport && destinationVolunteer && (
          <Popup
            longitude={destinationVolunteer.longitude}
            latitude={destinationVolunteer.latitude}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={30}
          >
            <VolunteerPopup
              vol={destinationVolunteer}
              isDestination
              distanceInfo={measureRoute ? { distance: measureRoute.distance, duration: measureRoute.duration } : undefined}
              now={now}
            />
          </Popup>
        )}
      </Map>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-[3px] border-orange border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <div className="font-mono text-[12px] font-bold text-dim uppercase tracking-[0.15em] mb-1">Initializing Map</div>
              <div className="font-mono text-[10px] font-semibold text-dim uppercase tracking-wider">Loading incident data...</div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => setMapStyle(NEXT_MAP_STYLE[mapStyle])}
          className="px-3 py-1.5 bg-void/85 backdrop-blur-sm border border-border-dim font-mono text-[10px] font-semibold text-muted uppercase tracking-wider hover:text-orange hover:border-orange/50 transition-color-snappy rounded-sm shadow-sm"
        >
          {MAP_STYLE_LABELS[NEXT_MAP_STYLE[mapStyle]]}
        </button>
        <button
          onClick={fitBoundsToData}
          className="px-3 py-1.5 bg-void/85 backdrop-blur-sm border border-border-dim font-mono text-[10px] text-muted uppercase tracking-wider hover:text-orange hover:border-orange/50 transition-all rounded-sm shadow-sm"
        >
          🎯 FIT VIEW
        </button>
        {(originReport || destinationVolunteer) && (
          <button
            onClick={clearRouteSelection}
            className="px-3 py-1.5 bg-alert/10 backdrop-blur-sm border border-alert/35 font-mono text-[10px] text-alert uppercase tracking-wider hover:bg-alert/15 transition-all rounded-sm shadow-sm"
          >
            ✕ CLEAR ROUTE
          </button>
        )}
      </div>

      {originReport && !destinationVolunteer && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="px-4 py-2 bg-void/85 backdrop-blur-sm border border-orange/50 font-mono text-[11px] text-orange uppercase tracking-wider rounded-sm shadow-sm">
            📍 Report selected · Click a responder to measure distance
          </div>
        </div>
      )}

      <div className="absolute bottom-20 left-4 z-10">
        <div className="px-3 py-2.5 bg-void/85 backdrop-blur-sm border border-border-dim rounded-sm shadow-sm">
          <div className="text-[9px] font-mono text-dim uppercase tracking-[0.15em] mb-2">Legend</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(SITUATION_STYLES).map(([type, data]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
                <span className="font-mono text-[9px] text-dim uppercase tracking-wider">{data.label}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-border-dim/50 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-ops border-2 border-white shadow" />
                <span className="font-mono text-[9px] text-dim uppercase">Volunteer ready</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange border-2 border-white shadow" />
                <span className="font-mono text-[9px] text-dim uppercase">On mission</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <div className="px-3 py-1.5 bg-void/85 backdrop-blur-sm border border-border-dim font-mono text-[9px] text-dim rounded-sm shadow-sm">
          {filteredReports.length} ACTIVE REPORTS · {volunteers.length} RESPONDERS IN VIEW
          {reports.length > locatedReports.length && ` · ${reports.length - locatedReports.length} WITHOUT GPS`}
        </div>
        {measureRoute && (
          <div className="px-3 py-1.5 bg-orange/10 backdrop-blur-sm border border-orange/50 font-mono text-[9px] text-orange rounded-sm shadow-sm">
            ↔ {measureRoute.distance} · {measureRoute.duration}
          </div>
        )}
      </div>

      <style jsx global>{`
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 4px !important;
        }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-popup { z-index: 50; }
        .mapboxgl-popup > .mapboxgl-popup-content { pointer-events: auto; }
      `}</style>
    </div>
  );
}
