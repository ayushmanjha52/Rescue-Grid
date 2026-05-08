"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl, ScaleControl, Source, Layer } from "react-map-gl/mapbox";
import { VolunteerMapLayer } from "./VolunteerMapLayer";
import mapboxgl from "mapbox-gl";
import type { Map as MapboxMapType } from 'react-map-gl/mapbox';
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
import { useNeeds, VictimReport } from "@/hooks/useNeeds";
import { useVolunteers, Volunteer } from "@/hooks/useVolunteers";
import { useAssignments } from "@/hooks/useAssignments";
import { useTaskForceMemberLocations, TaskForceMemberLocation } from "@/hooks/useTaskForceMemberLocations";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Map styles
const MAP_STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  navigation: "mapbox://styles/mapbox/navigation-day-v1"
};

const SITUATION_STYLES: Record<string, { color: string; label: string }> = {
  rescue: { color: "#FF3B3B", label: "RESCUE" },
  food: { color: "#2ECC71", label: "FOOD" },
  water: { color: "#3B8BFF", label: "WATER" },
  medical: { color: "#F5A623", label: "MEDICAL" },
  shelter: { color: "#9B59B6", label: "SHELTER" },
  missing: { color: "#6B7280", label: "MISSING" },
};

const STATUS_COLORS: Record<string, string> = {
  open: "#2ECC71",
  active: "#FF6B2B",
  assigned: "#3B8BFF",
  en_route: "#FF6B2B",
  arrived: "#2ECC71",
  resolved: "#6B7280",
  duplicate: "#F5A623",
};

interface POIPlace {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapboxMapProps {
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

function getVolunteerStatusColor(status: string): string {
  if (status === "on-mission") return "#FF6B2B";
  if (status === "standby") return "#F5A623";
  return "#2ECC71";
}

function VictimMarker({ 
  report, 
  isSelected, 
  onClick, 
  onMouseEnter, 
  onMouseLeave 
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
    >
      {isCritical && (
        <div 
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: style.color }}
        />
      )}
      {isAssigned && (
        <div 
          className="absolute -inset-2 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite]"
          style={{ borderColor: "#FF6B2B" }}
        />
      )}
      <div 
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${isSelected ? "scale-125 z-50" : ""}`}
        style={{ backgroundColor: style.color, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
      >
        <MapPin className="w-5 h-5 text-white" />
        <div 
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]"
          style={{ borderTopColor: style.color }}
        />
        
        {/* Status indicator dot */}
        <div 
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[#13161B]"
          style={{ backgroundColor: statusColor }}
        />
      </div>
      {isSelected && (
        <div className="absolute -inset-1 border-2 border-white rounded-full" />
      )}
    </div>
  );
}

function VolunteerMarker({ 
  volunteer, 
  onClick, 
  onMouseEnter, 
  onMouseLeave 
}: { 
  volunteer: Volunteer; 
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const statusColor = getVolunteerStatusColor(volunteer.status);

  return (
    <div
      className="relative cursor-pointer group"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div 
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: "#1A1E25", border: `3px solid ${statusColor}`, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
      >
        <div 
          className="absolute inset-0 rounded-full opacity-30"
          style={{ backgroundColor: statusColor }}
        />
        <span className="relative text-white font-bold text-sm">
          {volunteer.name?.charAt(0) || '?'}
        </span>
        <div 
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: statusColor, border: "2px solid #0D0F12" }}
        >
          <MapPin className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
    </div>
  );
}

function POIMarker({ 
  poi, 
  onClick, 
  onMouseEnter, 
  onMouseLeave 
}: { 
  poi: POIPlace; 
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const isHospital = poi.category === "hospital";
  const color = isHospital ? "#3B8BFF" : "#2ECC71";

  return (
    <div
      className="relative cursor-pointer group"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div 
        className="relative w-8 h-10 transition-transform group-hover:scale-110"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
      >
        <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path 
            d="M16 2C8.268 2 2 8.268 2 16C2 24 16 38 16 38C16 38 30 24 30 16C30 8.268 23.732 2 16 2Z" 
            fill={color} 
            stroke="white" 
            strokeWidth="2"
          />
          {isHospital ? (
            <>
              <rect x="13" y="10" width="6" height="12" fill="white" rx="1"/>
              <rect x="10" y="13" width="12" height="6" fill="white" rx="1"/>
            </>
          ) : (
            <>
              <path d="M16 12L16 24M12 16L20 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <rect x="10" y="26" width="12" height="4" fill="white" rx="1"/>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function MapboxMap({ filters, layers, onReportSelect, selectedReportId, dmaLocation }: MapboxMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [mapBbox, setMapBbox] = useState<string | undefined>(undefined);
  const { needs: victimReports } = useNeeds();
  const { volunteers } = useVolunteers({ bbox: mapBbox, zoom: currentZoom });
  const { assignments } = useAssignments();
  const { members: taskForceMembers } = useTaskForceMemberLocations();
  
  const victimReportsRef = useRef<VictimReport[]>([]);
  const volunteersRef = useRef<Volunteer[]>([]);
  const assignmentsRef = useRef<any[]>([]);
  const taskForceMembersRef = useRef<TaskForceMemberLocation[]>([]);
  
  victimReportsRef.current = victimReports;
  volunteersRef.current = volunteers;
  assignmentsRef.current = assignments;
  taskForceMembersRef.current = taskForceMembers;

  const routeGeometryRef = useRef<any>(null);
  // Store real route geometries from Directions API
  // Store real route geometries from Directions API
  const [routeGeometries, setRouteGeometries] = useState<Record<string, any>>({});
  const routeGeometriesRef = useRef<Record<string, any>>({});
  routeGeometriesRef.current = routeGeometries;

  // Fetch real route from MapBox Directions API
  const fetchRouteGeometry = useCallback(async (
    fromLng: number, 
    fromLat: number, 
    toLng: number, 
    toLat: number,
    routeKey: string
  ) => {
    // Check if we already have this route cached
    if (routeGeometriesRef.current[routeKey]) {
      return routeGeometriesRef.current[routeKey];
    }
    
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const geometry = data.routes[0].geometry;
        setRouteGeometries(prev => ({ ...prev, [routeKey]: geometry }));
        return geometry;
      }
    } catch (error) {
      console.error('Failed to fetch route:', error);
    }
    return null;
  }, []);

  // Active Mission GeoJSON - includes both individual volunteer and task force assignments
  // Uses real Directions API routes when available
  const activeMissionGeoJSON: any = {
    type: 'FeatureCollection',
    features: assignments
      .filter(a => a.status !== 'completed' && a.status !== 'failed')
      .flatMap(a => {
        const victim = victimReports.find(r => r.id === a.victim_report_id);
        if (!victim) return [];

        const features: any[] = [];

        // Handle individual volunteer assignment
        if (a.assigned_to_volunteer) {
          const volunteer = volunteers.find(v => v.id === a.assigned_to_volunteer);
          if (volunteer) {
            const routeKey = `vol-${volunteer.id}-${victim.id}`;
            const cachedGeometry = routeGeometries[routeKey];
            
            // Fetch real route if not cached
            if (!cachedGeometry) {
              fetchRouteGeometry(
                volunteer.longitude, 
                volunteer.latitude, 
                victim.longitude, 
                victim.latitude,
                routeKey
              );
            }
            
            features.push({
              type: 'Feature',
              geometry: cachedGeometry || {
                type: 'LineString',
                coordinates: [
                  [volunteer.longitude, volunteer.latitude],
                  [victim.longitude, victim.latitude]
                ]
              },
              properties: {
                status: a.status,
                id: a.id,
                type: 'volunteer',
                isRealRoute: !!cachedGeometry
              }
            });
          }
        }

        // Handle task force assignment - draw routes from all TF members (if layer enabled)
        if (a.assigned_to_taskforce && layers.taskForceRoutes) {
          const tfMembers = taskForceMembers.filter(m => m.task_force_id === a.assigned_to_taskforce);
          tfMembers.forEach(member => {
            const routeKey = `tf-${member.id}-${victim.id}`;
            const cachedGeometry = routeGeometries[routeKey];
            
            // Fetch real route if not cached
            if (!cachedGeometry) {
              fetchRouteGeometry(
                member.longitude, 
                member.latitude, 
                victim.longitude, 
                victim.latitude,
                routeKey
              );
            }
            
            features.push({
              type: 'Feature',
              geometry: cachedGeometry || {
                type: 'LineString',
                coordinates: [
                  [member.longitude, member.latitude],
                  [victim.longitude, victim.latitude]
                ]
              },
              properties: {
                status: a.status,
                id: a.id,
                type: 'taskforce',
                memberId: member.id,
                memberName: member.name,
                isRealRoute: !!cachedGeometry
              }
            });
          });
        }

        return features;
      }).filter(Boolean) as any[]
  };
  const dataFetchedRef = useRef(false);
  const fitBoundsToDataRef = useRef<(() => void) | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyleState] = useState<"streets" | "satellite" | "navigation">("streets");
  const [selectionMode, setSelectionMode] = useState<"normal" | "destination">("normal");
  const [originReport, setOriginReport] = useState<VictimReport | null>(null);
  const [destinationVolunteer, setDestinationVolunteer] = useState<Volunteer | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [poiData, setPoiData] = useState<{ hospitals: POIPlace[]; reliefCamps: POIPlace[] }>({ hospitals: [], reliefCamps: [] });
  
  const [hoveredReport, setHoveredReport] = useState<VictimReport | null>(null);
  const [hoveredVolunteer, setHoveredVolunteer] = useState<Volunteer | null>(null);
  const [hoveredPOI, setHoveredPOI] = useState<POIPlace | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ lng: number; lat: number } | null>(null);

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(filters);
  const layersRef = useRef(layers);
  const selectionModeRef = useRef(selectionMode);
  const originReportRef = useRef(originReport);
  
  filtersRef.current = filters;
  layersRef.current = layers;
  selectionModeRef.current = selectionMode;
  originReportRef.current = originReport;

  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getVolunteerStatusLabel = (status: string): string => {
    if (status === "on-mission") return "ON MISSION";
    if (status === "standby") return "STANDBY";
    if (status === "active") return "READY";
    return "OFFLINE";
  };

  const createReportPopupContent = (report: VictimReport, isOrigin = false) => {
    const style = SITUATION_STYLES[report.situation] || SITUATION_STYLES.rescue;
    const urgencyColor = report.urgency === "critical" ? "#FF3B3B" : report.urgency === "urgent" ? "#FF6B2B" : "#8A8F99";
    const statusColor = STATUS_COLORS[report.status] || "#6B7280";

    return (
      <div style={{ background: "#13161B", minWidth: 260, borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
        {isOrigin && (
          <div style={{ background: "#FF6B2B", padding: "6px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#000", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            📍 Origin Selected
          </div>
        )}
        <div style={{ borderLeft: `3px solid ${style.color}`, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: style.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>{style.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: urgencyColor, background: `${urgencyColor}20`, padding: "3px 6px", borderRadius: 2, textTransform: "uppercase" }}>{report.urgency}</span>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600, color: "#F0EDE8", marginBottom: 4 }}>
            📍 {report.city || "Unknown"}{report.district ? `, ${report.district.trim()}` : ""}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280", marginBottom: report.custom_message ? 8 : 0 }}>
            {report.phone_no} · {getTimeAgo(new Date(report.created_at))}
          </div>
          {report.custom_message && (
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#9CA3AF", fontStyle: "italic", lineHeight: 1.4, padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 3, marginBottom: 8 }}>
              "{report.custom_message.substring(0, 80)}{report.custom_message.length > 80 ? "..." : ""}"
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: statusColor }}>● {report.status?.toUpperCase() || "OPEN"}</span>
            {isOrigin && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: "#FF6B2B", textTransform: "uppercase" }}>Click responder to measure →</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const createVolunteerPopupContent = (vol: Volunteer, isDestination = false, distanceInfo?: { distance: string; duration: string }) => {
    const statusColor = getVolunteerStatusColor(vol.status);
    const statusLabel = getVolunteerStatusLabel(vol.status);
    const skills = Array.isArray(vol.skills) 
      ? vol.skills.map((s: string | number) => String(s).trim())
      : typeof vol.skills === 'string' 
        ? vol.skills.split(",").map((s: string) => s.trim()) 
        : [];
    const equipment = Array.isArray(vol.equipment)
      ? vol.equipment.map((s: string | number) => String(s).trim())
      : typeof vol.equipment === 'string' 
        ? vol.equipment.split(",").map((s: string) => s.trim()) 
        : [];

    return (
      <div style={{ background: "#13161B", minWidth: 240, borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
        {isDestination && (
          <div style={{ background: "#2ECC71", padding: "6px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#000", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            ✓ Destination Set
          </div>
        )}
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, background: "#1A1E25", border: `2px solid ${statusColor}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#F0EDE8" }}>
              {vol.name?.charAt(0) || '?'}
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600, color: "#F0EDE8" }}>{vol.name || 'Unknown'}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>{vol.type}</div>
            </div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: statusColor, textTransform: "uppercase", background: `${statusColor}15`, padding: "5px 10px", borderRadius: 3, display: "inline-block", marginBottom: 12 }}>
            {statusLabel}
          </div>
          {skills.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {skills.map((skill: string, i: number) => (
                  <span key={i} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#F0EDE8", background: "rgba(255,107,43,0.1)", border: "1px solid rgba(255,107,43,0.2)", padding: "3px 8px", borderRadius: 2 }}>{skill}</span>
                ))}
              </div>
            </div>
          )}
          {equipment.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Equipment</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {equipment.map((eq: string, i: number) => (
                  <span key={i} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#F0EDE8", background: "rgba(59,139,255,0.1)", border: "1px solid rgba(59,139,255,0.2)", padding: "3px 8px", borderRadius: 2 }}>{eq}</span>
                ))}
              </div>
            </div>
          )}
          {distanceInfo && (
            <div style={{ background: "linear-gradient(135deg,rgba(46,204,113,0.15),rgba(46,204,113,0.05))", border: "1px solid rgba(46,204,113,0.3)", borderRadius: 4, padding: 12, marginTop: 10 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2ECC71", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Route Info</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#2ECC71" }}>{distanceInfo.distance}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6B7280", textTransform: "uppercase" }}>Distance</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#F0EDE8" }}>{distanceInfo.duration}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6B7280", textTransform: "uppercase" }}>Est. Time</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {vol.mobile_no && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>📞 {vol.mobile_no}</span>
            )}
            {vol.tier && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>Tier {vol.tier}</span>
            )}
            {vol.last_seen && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>
                👁 {(() => {
                  const diff = Date.now() - new Date(vol.last_seen).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 1) return 'Just now';
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })()}
              </span>
            )}
            {vol.latitude && vol.longitude && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>
                📍 {vol.latitude.toFixed(4)}, {vol.longitude.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const createPoiPopupContent = (poi: POIPlace) => {
    return (
      <div style={{ background: "#13161B", minWidth: 200, borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", borderLeft: `3px solid ${poi.category === 'hospital' ? '#3B8BFF' : '#2ECC71'}` }}>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, color: "#F0EDE8", marginBottom: 4 }}>{poi.name}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>{poi.category}</div>
          {poi.address && <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#9CA3AF" }}>{poi.address}</div>}
        </div>
      </div>
    );
  };

  const fetchPOIData = useCallback(async (lat: number, lng: number) => {
    try {
      const categories = ["hospital", "relief_camp"];
      const results: POIPlace[] = [];
      
      for (const category of categories) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${category}.json?bbox=${lng - 1},${lat - 1},${lng + 1},${lat + 1}&limit=10&access_token=${MAPBOX_TOKEN}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features) {
          data.features.forEach((feature: any, index: number) => {
            results.push({
              id: `${category}-${index}`,
              name: feature.text || feature.place_name,
              category: category === "hospital" ? "hospital" : "reliefCamp",
              latitude: feature.center[1],
              longitude: feature.center[0],
              address: feature.properties.address || feature.place_name,
            });
          });
        }
      }
      
      setPoiData({
        hospitals: results.filter(p => p.category === "hospital"),
        reliefCamps: results.filter(p => p.category === "reliefCamp"),
      });
    } catch (error) {
      console.error("POI fetch error:", error);
    }
  }, []);

  const filteredReports = victimReports.filter((r) => {
    if (r.status === 'resolved') return false; // Hide resolved reports from map
    if (filters.situations.length > 0 && !filters.situations.includes(r.situation)) return false;
    if (filters.urgencies.length > 0 && !filters.urgencies.includes(r.urgency)) return false;
    if (filters.district && r.district?.trim() !== filters.district.trim()) return false;
    return true;
  });

  const fitBoundsToData = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;
    
    victimReportsRef.current.forEach((report) => {
      if (report.latitude && report.longitude) {
        bounds.extend([report.longitude, report.latitude]);
        hasPoints = true;
      }
    });
    
    volunteersRef.current.forEach((vol) => {
      if (vol.latitude && vol.longitude) {
        bounds.extend([vol.longitude, vol.latitude]);
        hasPoints = true;
      }
    });

    // Include task force member locations in bounds only if layer is enabled
    if (layers.taskForceRoutes) {
      taskForceMembersRef.current.forEach((member) => {
        if (member.latitude && member.longitude) {
          bounds.extend([member.longitude, member.latitude]);
          hasPoints = true;
        }
      });
    }
    
    if (routeGeometryRef.current?.coordinates) {
      routeGeometryRef.current.coordinates.forEach((coord: number[]) => {
        bounds.extend(coord as [number, number]);
        hasPoints = true;
      });
    }
    
    if (hasPoints && !bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds.toArray() as [[number, number], [number, number]], { 
        padding: { top: 60, bottom: 60, left: 60, right: 60 }, 
        maxZoom: 14, 
        duration: 1000, 
        essential: true 
      });
    }
  }, [layers.taskForceRoutes]);
  
  fitBoundsToDataRef.current = fitBoundsToData;

  const clearRouteSelection = useCallback(() => {
    setOriginReport(null);
    setDestinationVolunteer(null);
    setRouteInfo(null);
    setSelectionMode("normal");
    routeGeometryRef.current = null;
  }, []);

  const handleVictimClick = useCallback((report: VictimReport) => {
    if (selectionModeRef.current === "destination" || !originReportRef.current) {
      setOriginReport(report);
      setSelectionMode("destination");
      onReportSelect(report);
    }
  }, [onReportSelect]);

  const handleVolunteerClick = useCallback(async (vol: Volunteer) => {
    if (originReportRef.current && selectionModeRef.current === "destination") {
      setDestinationVolunteer(vol);
      
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originReportRef.current.longitude},${originReportRef.current.latitude};${vol.longitude},${vol.latitude}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        const durationText = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin} min`;
        
        const newRouteInfo = { distance: `${distanceKm} km`, duration: durationText };
        setRouteInfo(newRouteInfo);
        routeGeometryRef.current = route.geometry;
        
        setTimeout(() => fitBoundsToDataRef.current?.(), 100);
        setSelectionMode("normal");
      }
    }
  }, []);

  const initialBoundsFitted = useRef(false);

  useEffect(() => {
    if (mapLoaded && !initialBoundsFitted.current) {
      if (victimReports.length > 0 || volunteers.length > 0) {
        setTimeout(() => {
          fitBoundsToDataRef.current?.();
          initialBoundsFitted.current = true;
        }, 500);
      }
    }
  }, [mapLoaded, victimReports.length, volunteers.length]);

  useEffect(() => {
    if (dmaLocation) {
      fetchPOIData(dmaLocation.lat, dmaLocation.lng);
    }
  }, [dmaLocation, fetchPOIData]);

  useEffect(() => {
    if (!selectedReportId || !mapRef.current) return;
    const report = victimReportsRef.current.find((r) => r.id === selectedReportId);
    if (report?.latitude && report?.longitude) {
      mapRef.current.flyTo({ center: [report.longitude, report.latitude], zoom: 14, duration: 1000, essential: true });
    }
  }, [selectedReportId]);

  const routeGeoJSON: any = routeGeometryRef.current ? {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: routeGeometryRef.current }]
  } : { type: "FeatureCollection", features: [] };

  const showPopup = hoveredReport || hoveredVolunteer || hoveredPOI;

  return (
    <div className="relative w-full h-full">
      <Map
        ref={(ref) => { if (ref) mapRef.current = ref.getMap(); }}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 86.43,
          latitude: 23.79,
          zoom: 10
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        onLoad={() => {
          setMapLoaded(true);
          const map = mapRef.current;
          if (map) {
            const bounds = map.getBounds();
            if (bounds) {
              const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
              setMapBbox(bbox);
            }
          }
        }}
        onZoomEnd={(e) => {
          setCurrentZoom(Math.round(e.viewState.zoom));
          const map = mapRef.current;
          if (map) {
            const bounds = map.getBounds();
            if (bounds) {
              const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
              setMapBbox(bbox);
            }
          }
        }}
        interactiveLayerIds={layers.volunteers ? ['volunteers-unclustered'] : undefined}
        onMouseMove={(e) => {
          if (!layers.volunteers) return;
          const features = e.features || [];
          const volunteerFeature = features.find(f => f.layer?.id === 'volunteers-unclustered');
          if (volunteerFeature?.properties?.id) {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            const volunteer = volunteers.find(v => v.id === volunteerFeature.properties!.id);
            if (volunteer) {
              setHoveredVolunteer(volunteer);
              setPopupPosition({ lng: volunteer.longitude, lat: volunteer.latitude });
            }
          } else if (hoveredVolunteer && !volunteerFeature) {
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredVolunteer(null);
            }, 150);
          }
        }}
        onMouseLeave={() => {
          if (hoveredVolunteer) {
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredVolunteer(null);
            }, 150);
          }
        }}
        onClick={(e) => {
          if (!layers.volunteers) return;
          const features = e.features || [];
          const volunteerFeature = features.find(f => f.layer?.id === 'volunteers-unclustered');
          if (volunteerFeature?.properties?.id) {
            const volunteer = volunteers.find(v => v.id === volunteerFeature.properties!.id);
            if (volunteer) {
              handleVolunteerClick(volunteer);
            }
          }
          const clusterFeature = features.find(f => f.layer?.id === 'volunteers-clusters');
          if (clusterFeature?.properties?.cluster_id !== undefined) {
            const clusterId = clusterFeature.properties.cluster_id as number;
            const coordinates = (clusterFeature.geometry as GeoJSON.Point).coordinates as [number, number];
            const source = mapRef.current?.getSource('volunteers') as mapboxgl.GeoJSONSource;
            if (source) {
              source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (!err && zoom !== null && zoom !== undefined && mapRef.current) {
                  mapRef.current.flyTo({
                    center: coordinates,
                    zoom: zoom + 0.5,
                    duration: 500
                  });
                }
              });
            }
          }
        }}
      >
        <NavigationControl position="bottom-right" />
        <ScaleControl />

        {layers.needPins && filteredReports.map((report) => (
          <Marker
            key={report.id}
            longitude={report.longitude}
            latitude={report.latitude}
            anchor="bottom"
          >
            <VictimMarker
              report={report}
              isSelected={report.id === selectedReportId}
              onClick={() => handleVictimClick(report)}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredReport(report);
                setPopupPosition({ lng: report.longitude, lat: report.latitude });
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredReport(null);
                }, 150);
              }}
            />
          </Marker>
        ))}

        {layers.volunteers && (
          <VolunteerMapLayer 
            volunteers={volunteers} 
            onVolunteerClick={handleVolunteerClick}
            onClusterClick={(clusterId, coordinates) => {
              const source = mapRef.current?.getSource('volunteers') as mapboxgl.GeoJSONSource;
              if (source) {
                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                  if (!err && zoom !== null && zoom !== undefined && mapRef.current) {
                    mapRef.current.flyTo({
                      center: coordinates,
                      zoom: zoom + 0.5,
                      duration: 500
                    });
                  }
                });
              }
            }}
          />
        )}

        {layers.hospitals && poiData.hospitals.map((poi) => (
          <Marker
            key={`poi-${poi.id}`}
            longitude={poi.longitude}
            latitude={poi.latitude}
            anchor="bottom"
          >
            <POIMarker
              poi={poi}
              onClick={() => {}}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredPOI(poi);
                setPopupPosition({ lng: poi.longitude, lat: poi.latitude });
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredPOI(null);
                }, 150);
              }}
            />
          </Marker>
        ))}

        {layers.reliefCamps && poiData.reliefCamps.map((poi) => (
          <Marker
            key={`poi-${poi.id}`}
            longitude={poi.longitude}
            latitude={poi.latitude}
            anchor="bottom"
          >
            <POIMarker
              poi={poi}
              onClick={() => {}}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredPOI(poi);
                setPopupPosition({ lng: poi.longitude, lat: poi.latitude });
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredPOI(null);
                }, 150);
              }}
            />
          </Marker>
        ))}

        {/* Active Mission Routes - Real Routes vs Straight Lines */}
        <Source id="active-missions" type="geojson" data={activeMissionGeoJSON}>
          {/* Real routes - solid bright orange */}
          <Layer
            id="mission-routes-real"
            type="line"
            filter={["==", ["get", "isRealRoute"], true]}
            paint={{
              "line-color": "#FF6B2B",
              "line-width": 3,
              "line-opacity": 0.85
            }}
          />
          {/* Temporary straight lines - dashed dimmed */}
          <Layer
            id="mission-routes-temp"
            type="line"
            filter={["!=", ["get", "isRealRoute"], true]}
            paint={{
              "line-color": "#FF6B2B",
              "line-width": 2,
              "line-dasharray": [4, 3],
              "line-opacity": 0.4
            }}
          />
          {/* Casing for all routes */}
          <Layer
            id="mission-routes-casing"
            type="line"
            paint={{
              "line-color": "#000000",
              "line-width": 5,
              "line-opacity": 0.25
            }}
          />
        </Source>

        {/* Measuring Route */}
        {routeGeometryRef.current && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#FF6B2B", "line-width": 5, "line-opacity": 0.9 }}
            />
          </Source>
        )}

        {showPopup && popupPosition && (
          <Popup
            longitude={popupPosition.lng}
            latitude={popupPosition.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={30}
          >
            <div
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredReport(null);
                  setHoveredVolunteer(null);
                  setHoveredPOI(null);
                }, 100);
              }}
            >
              {hoveredReport && createReportPopupContent(hoveredReport)}
              {hoveredVolunteer && createVolunteerPopupContent(hoveredVolunteer)}
              {hoveredPOI && createPoiPopupContent(hoveredPOI)}
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
            {createVolunteerPopupContent(destinationVolunteer, true, routeInfo || undefined)}
          </Popup>
        )}
      </Map>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-[3px] border-orange border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-[3px] border-orange/30 rounded-full animate-ping"></div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[12px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1">Initializing Map</div>
              <div className="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Loading incident data...</div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => setMapStyleState(mapStyle === "streets" ? "satellite" : mapStyle === "satellite" ? "navigation" : "streets")}
          className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 font-mono text-[10px] font-semibold text-gray-600 uppercase tracking-wider hover:text-orange hover:border-orange/50 transition-color-snappy rounded-sm shadow-sm"
        >
          {mapStyle === "streets" ? "🛰️ SATELLITE" : mapStyle === "satellite" ? "🧭 NAV" : "🗺️ STREETS"}
        </button>
        <button 
          onClick={() => fitBoundsToDataRef.current?.()}
          className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 font-mono text-[10px] text-gray-600 uppercase tracking-wider hover:text-orange hover:border-orange/50 transition-all rounded-sm shadow-sm"
        >
          🎯 FIT VIEW
        </button>
        {(originReport || destinationVolunteer) && (
          <button 
            onClick={clearRouteSelection}
            className="px-3 py-1.5 bg-red-50 backdrop-blur-sm border border-red-200 font-mono text-[10px] text-red-600 uppercase tracking-wider hover:bg-red-100 transition-all rounded-sm shadow-sm"
          >
            ✕ CLEAR ROUTE
          </button>
        )}
      </div>

      {selectionMode === "destination" && originReport && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="px-4 py-2 bg-white/95 backdrop-blur-sm border border-orange/50 font-mono text-[11px] text-orange uppercase tracking-wider rounded-sm shadow-sm">
            📍 Origin selected · Click a responder to measure distance
          </div>
        </div>
      )}

      <div className="absolute bottom-20 left-4 z-10">
        <div className="px-3 py-2.5 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-sm shadow-sm">
          <div className="text-[9px] font-mono text-gray-400 uppercase tracking-[0.15em] mb-2">Legend</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(SITUATION_STYLES).map(([type, data]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
                <span className="font-mono text-[9px] text-gray-500 uppercase tracking-wider">{data.label}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-gray-200/50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-[#3B8BFF]"></div>
                <span className="font-mono text-[9px] text-gray-500 uppercase">Hospital</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#2ECC71]"></div>
                <span className="font-mono text-[9px] text-gray-500 uppercase">Relief Camp</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <div className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 font-mono text-[9px] text-gray-500 rounded-sm shadow-sm">
          {victimReportsRef.current.length} REPORTS · {volunteersRef.current.length} RESPONDERS
        </div>
        {routeInfo && (
          <div className="px-3 py-1.5 bg-orange/10 backdrop-blur-sm border border-orange/50 font-mono text-[9px] text-orange rounded-sm shadow-sm">
            ↔ {routeInfo.distance} · {routeInfo.duration}
          </div>
        )}
      </div>

      {/* Fixed popup hover styles */}
      {/* Fixed popup hover styles */}
      <style jsx global>{`
        .mapboxgl-popup-content { 
          background: transparent !important; 
          padding: 0 !important; 
          box-shadow: none !important; 
          border-radius: 4px !important;
        }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-popup { z-index: 50; }
        /* Prevent black hover background */
        .mapboxgl-popup-content > div {
          background: transparent !important;
        }
        .mapboxgl-popup-content > div:hover {
          background: transparent !important;
        }
        /* Ensure popup container doesn't interfere */
        .mapboxgl-popup > .mapboxgl-popup-content {
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}
