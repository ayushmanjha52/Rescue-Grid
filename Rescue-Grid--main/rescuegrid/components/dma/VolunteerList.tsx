"use client";

import { useEffect, useState } from "react";
import { useVolunteers, Volunteer } from "@/hooks/useVolunteers";

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
    case "ready":
      return "bg-ops";
    case "on-mission":
      return "bg-orange";
    case "standby":
      return "bg-caution";
    case "offline":
      return "bg-dim";
    default:
      return "bg-ops";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
    case "ready":
      return "READY";
    case "on-mission":
      return "ON MISSION";
    case "standby":
      return "STANDBY";
    case "offline":
      return "OFFLINE";
    default:
      return "READY";
  }
}

function formatLastSeen(lastSeen: string | null | undefined): string {
  if (!lastSeen) return "Unknown";
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function VolunteerList() {
  const { volunteers, loading } = useVolunteers();
  const [expandedVolunteer, setExpandedVolunteer] = useState<string | null>(null);

  if (loading && volunteers.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="font-mono text-[9px] text-dim uppercase tracking-widest">Tracking Responders...</p>
      </div>
    );
  }

  // Sort: active/on-mission first, then by last_seen
  const sortedVolunteers = [...volunteers].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      "on-mission": 0,
      "active": 1,
      "ready": 1,
      "standby": 2,
      "offline": 3,
    };
    const orderA = statusOrder[a.status] ?? 4;
    const orderB = statusOrder[b.status] ?? 4;
    if (orderA !== orderB) return orderA - orderB;
    
    // Sort by last_seen (most recent first) if same status
    const timeA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
    const timeB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <section className="border-t border-border-dim pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-[10px] text-dim uppercase tracking-[0.2em]">
          ACTIVE RESPONDERS
        </h3>
        <span className="font-mono text-[10px] text-orange">
          {volunteers.filter(v => v.status === 'active' || v.status === 'on-mission' || v.status === 'ready').length} LIVE
        </span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {sortedVolunteers.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-mono text-[10px] text-dim/50 uppercase">
              No responders with location
            </p>
          </div>
        ) : (
          sortedVolunteers.map((vol) => (
            <div
              key={vol.id}
              className="bg-surface-2 border-l-[3px] border-l-transparent hover:border-l-orange transition-all cursor-pointer"
              onClick={() => setExpandedVolunteer(expandedVolunteer === vol.id ? null : vol.id)}
            >
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusColor(vol.status)} ${vol.status === 'on-mission' ? 'animate-pulse' : ''}`}
                    />
                    <span className="font-display text-[13px] font-semibold uppercase text-ink">
                      {vol.name}
                    </span>
                  </div>
                  <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 ${getStatusColor(vol.status)} bg-opacity-20 text-white`}>
                    {getStatusLabel(vol.status)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-[9px] text-dim uppercase">
                    {vol.type || "Individual"}
                  </span>
                  <span className="font-mono text-[9px] text-dim/50">
                    {formatLastSeen(vol.last_seen)}
                  </span>
                </div>

                {expandedVolunteer === vol.id && (
                  <div className="mt-3 pt-3 border-t border-border-dim space-y-2">
                    {vol.skills && (
                      <div>
                        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Skills</span>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(vol.skills) ? vol.skills : vol.skills.split(",")).map((skill, i) => (
                            <span
                              key={i}
                              className="font-mono text-[9px] text-ink bg-surface-3 px-1.5 py-0.5"
                            >
                              {String(skill).trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {vol.equipment && (
                      <div>
                        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Equipment</span>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(vol.equipment) ? vol.equipment : vol.equipment.split(",")).map((eq, i) => (
                            <span
                              key={i}
                              className="font-mono text-[9px] text-ink bg-surface-3 px-1.5 py-0.5"
                            >
                              {String(eq).trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {vol.mobile_no && (
                      <div className="font-mono text-[10px] text-dim">
                        📞 {vol.mobile_no}
                      </div>
                    )}
                    {vol.latitude && vol.longitude && (
                      <div className="font-mono text-[9px] text-dim/50">
                        📍 {vol.latitude.toFixed(4)}, {vol.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
