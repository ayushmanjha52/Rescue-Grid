"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";

interface Volunteer {
  id: string;
  name: string;
  type: string;
  status: string;
  skills?: string | string[];
  skills_ids?: number[];
  equipment?: string | string[];
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  last_seen?: string;
  relevance_score?: number;
  score?: number;
  tier?: number;
}

interface TaskForce {
  id: string;
  name: string;
  status: string;
}

interface VictimReportFull {
  id: string;
  situation: string;
  city: string;
  district: string;
  urgency: string;
  latitude?: number;
  longitude?: number;
  status?: string;
}

interface CreateAssignmentModalProps {
  linkedReportId?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const SKILL_OPTIONS = [
  "medical", "rescue", "first-aid", "swimming", "climbing",
  "driving", "communications", "logistics", "search", "firefighting",
  "water-rescue", "extraction", "navigation"
];

const EQUIPMENT_OPTIONS = [
  "boat", "ladder", "radio", "first-aid-kit", " stretcher",
  "flashlight", "generator", "chainsaw", "rope", "life-jacket"
];

const VOLUNTEER_STATUS_OPTIONS = [
  { value: "active", label: "Active/Ready" },
  { value: "standby", label: "Standby" },
  { value: "all", label: "All" },
];

export default function CreateAssignmentModal({ linkedReportId, onClose, onCreated }: CreateAssignmentModalProps) {
  const [task, setTask] = useState("");
  const [urgency, setUrgency] = useState<"critical" | "urgent" | "moderate">("moderate");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [assigneeType, setAssigneeType] = useState<"volunteer" | "taskforce" | null>(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState("");
  const [selectedTaskForce, setSelectedTaskForce] = useState("");
  const [timer, setTimer] = useState("");
  const [selectedReport, setSelectedReport] = useState(linkedReportId || "");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [taskForces, setTaskForces] = useState<TaskForce[]>([]);
  const [victimReports, setVictimReports] = useState<VictimReportFull[]>([]);

  // Searchable volunteer state with filters
  const [volunteerSearch, setVolunteerSearch] = useState("");
  const [volunteerResults, setVolunteerResults] = useState<Volunteer[]>([]);
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [showVolunteerDropdown, setShowVolunteerDropdown] = useState(false);
  const [volunteerPage, setVolunteerPage] = useState(0);
  const [volunteerHasMore, setVolunteerHasMore] = useState(false);
  const [volunteerTotal, setVolunteerTotal] = useState(0);
  const volunteerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Volunteer filters
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [volunteerStatusFilter, setVolunteerStatusFilter] = useState<string>("active");
  const [searchRadius, setSearchRadius] = useState<number>(50);
  const [showFilters, setShowFilters] = useState(false);

  // Inline task force creation
  const [showCreateTaskForce, setShowCreateTaskForce] = useState(false);
  const [newTFName, setNewTFName] = useState("");
  const [newTFMembers, setNewTFMembers] = useState<string[]>([]);
  const [creatingTF, setCreatingTF] = useState(false);
  const [taskForcesLoaded, setTaskForcesLoaded] = useState(false);

  // Load volunteers when task force creation panel opens
  useEffect(() => {
    if (showCreateTaskForce && volunteerResults.length === 0) {
      searchVolunteers("", 0, true, true);
    }
  }, [showCreateTaskForce, volunteerResults.length]);

  // Auto-show task force creation when switching to taskforce and none exist
  useEffect(() => {
    if (assigneeType === "taskforce" && taskForcesLoaded) {
      const activeTaskForces = taskForces.filter(tf => tf.status === "active");
      if (activeTaskForces.length === 0 && !selectedTaskForce) {
        setShowCreateTaskForce(true);
      }
    }
  }, [assigneeType, taskForces, taskForcesLoaded, selectedTaskForce]);

  // Mark task forces as loaded after initial load
  useEffect(() => {
    if (taskForces.length > 0 && !taskForcesLoaded) {
      setTaskForcesLoaded(true);
    }
  }, [taskForces, taskForcesLoaded]);

  useEffect(() => {
    Promise.all([
      fetch("/api/dma/taskforce/list").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/victim/reports").then(r => r.json()),
    ]).then(([tfs, reports]) => {
      setTaskForces(Array.isArray(tfs) ? tfs : []);
      const reportsArr = Array.isArray(reports) ? reports : [];
      setVictimReports(reportsArr);

      if (linkedReportId && reportsArr.length > 0) {
        const report = reportsArr.find((r: any) => r.id === linkedReportId);
        if (report) {
          setSelectedReport(linkedReportId);
          if (report.latitude && report.longitude) {
            setLatitude(report.latitude);
            setLongitude(report.longitude);
            const label = [report.city, report.district].filter(Boolean).join(', ');
            setLocationLabel(label || report.latitude.toFixed(4) + ', ' + report.longitude.toFixed(4));
          }
        }
      }
    }).catch(() => {});
  }, [linkedReportId]);

  const searchVolunteers = useCallback(async (query: string, page: number = 0, reset: boolean = true, forTaskForce: boolean = false) => {
    setVolunteerLoading(true);
    try {
      if (latitude && longitude) {
        const body: any = {
          latitude,
          longitude,
          radius_km: searchRadius,
          limit: 50,
        };
        if (selectedSkills.length > 0) {
          body.skill_codes = selectedSkills.map(s => s.toLowerCase().replace(/\s+/g, '_'));
        }

        const res = await fetch('/api/volunteer/search/scored', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          let results = data.volunteers || [];
          
          if (query) {
            results = results.filter((v: Volunteer) => 
              v.name.toLowerCase().includes(query.toLowerCase())
            );
          }
          
          if (reset) {
            setVolunteerResults(results);
          } else {
            setVolunteerResults(prev => [...prev, ...results]);
          }
          setVolunteerHasMore(false);
          setVolunteerTotal(results.length);
        }
      } else {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("status", volunteerStatusFilter === "all" ? "" : volunteerStatusFilter);
        if (selectedSkills.length > 0) params.set("skills", selectedSkills.join(","));
        if (selectedEquipment.length > 0) params.set("equipment", selectedEquipment.join(","));
        params.set("limit", "50");
        params.set("offset", (page * 50).toString());

        const res = await fetch(`/api/volunteer/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (reset) {
            setVolunteerResults(data.data || []);
          } else {
            setVolunteerResults(prev => [...prev, ...data.data || []]);
          }
          setVolunteerHasMore(data.hasMore);
          setVolunteerTotal(data.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to search volunteers:", err);
    } finally {
      setVolunteerLoading(false);
    }
  }, [latitude, longitude, searchRadius, volunteerStatusFilter, selectedSkills, selectedEquipment]);

  const calculateRelevanceScore = (volunteer: Volunteer, taskDescription: string): number => {
    let score = 0;
    const taskLower = taskDescription.toLowerCase();
    
    if (volunteer.distance_km !== undefined && volunteer.distance_km !== null) {
      score += Math.max(0, 30 - volunteer.distance_km * 2);
    }
    
    if (volunteer.skills) {
      const skillsList = Array.isArray(volunteer.skills)
        ? volunteer.skills.map(s => String(s).toLowerCase().trim())
        : volunteer.skills.toLowerCase().split(",").map(s => s.trim());
      const taskKeywords = taskLower.split(/\s+/);
      const matches = skillsList.filter(skill => taskKeywords.some(kw => kw.includes(skill) || skill.includes(kw)));
      score += matches.length * 15;
    }
    
    if (volunteer.equipment) {
      const equipmentList = Array.isArray(volunteer.equipment)
        ? volunteer.equipment.map(e => String(e).toLowerCase().trim())
        : volunteer.equipment.toLowerCase().split(",").map(e => e.trim());
      const matches = equipmentList.filter(eq => taskLower.includes(eq));
      score += matches.length * 10;
    }
    
    if (volunteer.status === "active") score += 10;
    if (volunteer.status === "on-mission") score -= 20;
    
    return Math.round(score);
  };

  // Load volunteers when assignee type changes to volunteer (immediate, no debounce)
  useEffect(() => {
    if (assigneeType === "volunteer") {
      searchVolunteers(volunteerSearch, 0, true, false);
      setVolunteerPage(0);
    } else if (assigneeType === "taskforce" && showCreateTaskForce) {
      searchVolunteers(volunteerSearch, 0, true, true);
    }
  }, [assigneeType, showCreateTaskForce, volunteerSearch]);

  // Debounced search when user types
  useEffect(() => {
    if (assigneeType === "volunteer" || (assigneeType === "taskforce" && showCreateTaskForce)) {
      const timeoutId = setTimeout(() => {
        searchVolunteers(volunteerSearch, 0, true, assigneeType === "taskforce");
        setVolunteerPage(0);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [volunteerSearch, assigneeType, showCreateTaskForce]);

  // Immediate filter changes (skills, equipment, status, radius)
  useEffect(() => {
    if (assigneeType === "volunteer") {
      searchVolunteers(volunteerSearch, 0, true, false);
    } else if (assigneeType === "taskforce" && showCreateTaskForce) {
      searchVolunteers(volunteerSearch, 0, true, true);
    }
  }, [selectedSkills, selectedEquipment, volunteerStatusFilter, searchRadius, assigneeType, showCreateTaskForce, volunteerSearch]);

  const loadMoreVolunteers = () => {
    if (volunteerHasMore && !volunteerLoading) {
      const nextPage = volunteerPage + 1;
      setVolunteerPage(nextPage);
      searchVolunteers(volunteerSearch, nextPage, false);
    }
  };

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const timer2 = setTimeout(() => {
      if (locationLabel) {
        fetchSuggestions(locationLabel);
      }
    }, 300);
    return () => clearTimeout(timer2);
  }, [locationLabel, fetchSuggestions]);

  const handleSelectSuggestion = (place: any) => {
    setLocationLabel(place.place_name);
    setLatitude(place.center[1]);
    setLongitude(place.center[0]);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    setLocationLabel("");
    setLatitude(null);
    setLongitude(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleCreateTaskForce = async () => {
    if (!newTFName.trim() || newTFMembers.length === 0) return;
    setCreatingTF(true);
    try {
      const res = await fetch("/api/dma/taskforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTFName.trim(),
          member_ids: newTFMembers,
          assignment_id: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task force");
      const newTF = await res.json();
      
      setTaskForces(prev => [...prev, { id: newTF.id, name: newTF.name, status: "active" }]);
      
      setSelectedTaskForce(newTF.id);
      setShowCreateTaskForce(false);
      setNewTFName("");
      setNewTFMembers([]);
    } catch (err: any) {
      setError(err.message || "Failed to create task force");
    } finally {
      setCreatingTF(false);
    }
  };

  const handleCreateTaskForceFromSearch = async () => {
    if (newTFMembers.length === 0) return;
    const suggestedName = `TF-${Date.now().toString(36).toUpperCase()}`;
    setNewTFName(suggestedName);
    setShowCreateTaskForce(true);
  };

  const isValid = task.trim() && locationLabel.trim() && latitude !== null && longitude !== null && assigneeType && ((assigneeType === "volunteer" && selectedVolunteer) || (assigneeType === "taskforce" && selectedTaskForce));

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        task: task.trim(),
        urgency,
        location_label: locationLabel,
        latitude,
        longitude,
        victim_report_id: selectedReport || null,
        timer: timer || null,
      };

      if (assigneeType === "volunteer") {
        payload.assigned_to_volunteer = selectedVolunteer;
      } else {
        payload.assigned_to_taskforce = selectedTaskForce;
      }

      const res = await fetch("/api/dma/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create assignment");
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const getVolunteerStatus = (status: string): "ready" | "on-mission" | "standby" => {
    if (status === "active") return "ready";
    if (status === "on_mission" || status === "on-mission") return "on-mission";
    return "standby";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80">
      <div
        className="w-[700px] max-h-[90vh] overflow-y-auto bg-surface-2 border-t-[2px] border-orange"
        style={{ clipPath: "var(--clip-tactical)" }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-[24px] font-bold uppercase tracking-wide text-ink">
              CREATE ASSIGNMENT
            </h2>
            <button
              onClick={onClose}
              className="font-mono text-[11px] text-dim uppercase tracking-wider hover:text-ink transition-colors"
            >
              ✕ CLOSE
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-alert/10 border border-alert/30 font-mono text-[11px] text-alert">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                TASK DESCRIPTION *
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={3}
                placeholder="Rescue 30 civilians at riverbank sector 4..."
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange resize-none"
              />
            </div>

            <div className="relative">
              <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                LOCATION *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locationLabel}
                  onChange={(e) => {
                    setLocationLabel(e.target.value);
                    if (latitude) setLatitude(null);
                    if (longitude) setLongitude(null);
                  }}
                  placeholder="Search for a location..."
                  className="w-full px-3 py-2 pr-8 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange"
                />
                {locationLabel && (
                  <button
                    onClick={handleClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-dim hover:text-ink"
                  >
                    ✕
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-surface-3 border border-border-dim shadow-xl max-h-48 overflow-y-auto">
                  {suggestions.map((place: any) => (
                    <button
                      key={place.id}
                      onClick={() => handleSelectSuggestion(place)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-4 border-b border-border-dim/50 last:border-b-0"
                    >
                      <div className="font-body text-[13px] text-ink">{place.place_name}</div>
                      <div className="font-mono text-[10px] text-dim">
                        {place.center[1].toFixed(4)}, {place.center[0].toFixed(4)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {latitude !== null && longitude !== null && (
                <div className="mt-1 font-mono text-[10px] text-ops">
                  ✓ Coordinates set: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </div>
              )}
            </div>

            <div>
              <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-2">
                URGENCY *
              </label>
              <div className="flex gap-3">
                {(["critical", "urgent", "moderate"] as const).map((level) => (
                  <label key={level} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="urgency"
                      value={level}
                      checked={urgency === level}
                      onChange={() => setUrgency(level)}
                      className="accent-orange"
                    />
                    <span className={`font-mono text-[11px] uppercase tracking-wider ${
                      urgency === level ? "text-orange" : "text-dim"
                    }`}>
                      {level}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-2">
                ASSIGN TO *
              </label>
              <div className="flex gap-6 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assigneeType"
                    value="volunteer"
                    checked={assigneeType === "volunteer"}
                    onChange={() => {
                      setAssigneeType("volunteer");
                      setSelectedTaskForce("");
                    }}
                    className="accent-orange"
                  />
                  <span className={`font-mono text-[11px] uppercase tracking-wider ${
                    assigneeType === "volunteer" ? "text-orange" : "text-dim"
                  }`}>
                    Individual Volunteer
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assigneeType"
                    value="taskforce"
                    checked={assigneeType === "taskforce"}
                    onChange={() => {
                      setAssigneeType("taskforce");
                      setSelectedVolunteer("");
                      if (taskForces.filter(tf => tf.status === "active").length === 0) {
                        setShowCreateTaskForce(true);
                      }
                    }}
                    className="accent-orange"
                  />
                  <span className={`font-mono text-[11px] uppercase tracking-wider ${
                    assigneeType === "taskforce" ? "text-orange" : "text-dim"
                  }`}>
                    Task Force
                  </span>
                </label>
              </div>

              {assigneeType === "volunteer" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={volunteerSearch}
                      onChange={(e) => setVolunteerSearch(e.target.value)}
                      onFocus={() => {
                        setShowVolunteerDropdown(true);
                        if (volunteerResults.length === 0 && !volunteerLoading) {
                          searchVolunteers("", 0, true, false);
                        }
                      }}
                      placeholder="Search volunteers..."
                      className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange"
                    />
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                        showFilters ? "bg-orange text-void" : "bg-surface-3 text-dim hover:text-ink"
                      }`}
                    >
                      ⚙ Filters {selectedSkills.length + selectedEquipment.length > 0 && `(${selectedSkills.length + selectedEquipment.length})`}
                    </button>
                  </div>
                  
                  {showFilters && (
                    <div className="p-3 bg-surface-3 border border-border-dim space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-dim uppercase">Distance: {searchRadius}km</span>
                        <input
                          type="range"
                          min="5"
                          max="100"
                          value={searchRadius}
                          onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                          className="w-24 accent-orange"
                        />
                      </div>
                      
                      <div>
                        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Status</span>
                        <div className="flex gap-2">
                          {VOLUNTEER_STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setVolunteerStatusFilter(opt.value)}
                              className={`px-2 py-1 font-mono text-[9px] uppercase transition-colors ${
                                volunteerStatusFilter === opt.value
                                  ? "bg-orange text-void"
                                  : "bg-surface-4 text-dim hover:text-ink"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Skills</span>
                        <div className="flex flex-wrap gap-1">
                          {SKILL_OPTIONS.map(skill => (
                            <button
                              key={skill}
                              onClick={() => setSelectedSkills(prev =>
                                prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
                              )}
                              className={`px-2 py-0.5 font-mono text-[9px] uppercase transition-colors ${
                                selectedSkills.includes(skill)
                                  ? "bg-ops text-void"
                                  : "bg-surface-4 text-dim hover:text-ink"
                              }`}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Equipment</span>
                        <div className="flex flex-wrap gap-1">
                          {EQUIPMENT_OPTIONS.map(eq => (
                            <button
                              key={eq}
                              onClick={() => setSelectedEquipment(prev =>
                                prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
                              )}
                              className={`px-2 py-0.5 font-mono text-[9px] uppercase transition-colors ${
                                selectedEquipment.includes(eq)
                                  ? "bg-ops text-void"
                                  : "bg-surface-4 text-dim hover:text-ink"
                              }`}
                            >
                              {eq}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {(selectedSkills.length > 0 || selectedEquipment.length > 0 || volunteerStatusFilter !== "active") && (
                        <button
                          onClick={() => {
                            setSelectedSkills([]);
                            setSelectedEquipment([]);
                            setVolunteerStatusFilter("active");
                          }}
                          className="font-mono text-[9px] text-orange hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  )}
                  
                  {showVolunteerDropdown && (
                    <div className="relative">
                      <div className="absolute z-50 w-full max-h-80 overflow-y-auto bg-surface-3 border border-border-dim shadow-xl">
                        {volunteerLoading && volunteerResults.length === 0 ? (
                          <div className="p-4 text-center font-mono text-[11px] text-dim">
                            <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            Loading volunteers...
                          </div>
                        ) : volunteerResults.length === 0 ? (
                          <div className="p-4 text-center font-mono text-[11px] text-dim">
                            {volunteerSearch || selectedSkills.length > 0 
                              ? "No volunteers match your filters" 
                              : latitude && longitude 
                                ? "No volunteers found within range. Increase distance radius."
                                : "Set a location to find nearby volunteers"}
                          </div>
                        ) : (
                          <>
                            <div className="sticky top-0 bg-surface-4 px-3 py-2 font-mono text-[9px] text-dim border-b border-border-dim flex items-center justify-between">
                              <span>{volunteerTotal} volunteers • Showing {volunteerResults.length}</span>
                              {latitude && longitude && (
                                <span className="text-ops">Sorted by nearest</span>
                              )}
                            </div>
                            {volunteerResults.map((vol) => {
                              const isSelected = selectedVolunteer === vol.id;
                              return (
                                <button
                                  key={vol.id}
                                  onClick={() => {
                                    setSelectedVolunteer(vol.id);
                                    setShowVolunteerDropdown(false);
                                    setVolunteerSearch(vol.name);
                                  }}
                                  className={`w-full flex items-center justify-between p-3 border-b border-border-dim/50 last:border-b-0 transition-colors ${
                                    isSelected ? "bg-ops/10 border-l-4 border-l-ops" : "hover:bg-surface-4"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <div className="font-body text-[13px] text-ink font-semibold">{vol.name}</div>
                                      <div className="flex items-center gap-2 font-mono text-[10px] text-dim">
                                        <span>{vol.type}</span>
                                        {Array.isArray(vol.skills) 
                                          ? vol.skills.slice(0, 2).map((s, i) => (
                                            <span key={i} className="text-ops/70">{String(s).trim()}</span>
                                          ))
                                          : typeof vol.skills === 'string'
                                          ? vol.skills.split(",").slice(0, 2).map((s, i) => (
                                            <span key={i} className="text-ops/70">{s.trim()}</span>
                                          ))
                                          : null}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {vol.distance_km !== undefined && (
                                      <span className={`font-mono text-[10px] ${vol.distance_km < 10 ? 'text-ops font-bold' : 'text-dim'}`}>
                                        {vol.distance_km < 1 ? '<1km' : `${vol.distance_km}km`}
                                      </span>
                                    )}
                                    <StatusBadge status={getVolunteerStatus(vol.status)} />
                                  </div>
                                </button>
                              );
                            })}
                            {volunteerHasMore && (
                              <button
                                onClick={loadMoreVolunteers}
                                className="w-full py-2 font-mono text-[11px] text-orange hover:bg-surface-4 transition-colors"
                              >
                                Load more ({volunteerTotal - volunteerResults.length} remaining)
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => setShowVolunteerDropdown(false)}
                        className="absolute top-full left-0 right-0 h-4 bg-transparent"
                      />
                    </div>
                  )}
                  
                  {selectedVolunteer && (
                    <div className="mt-2 p-2 bg-ops/10 border border-ops/30 flex items-center justify-between">
                      <span className="font-body text-[13px] text-ink">
                        Selected: {volunteerResults.find(v => v.id === selectedVolunteer)?.name || "Unknown"}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedVolunteer("");
                          setVolunteerSearch("");
                        }}
                        className="font-mono text-[10px] text-dim hover:text-alert"
                      >
                        ✕ Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {assigneeType === "taskforce" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedTaskForce}
                      onChange={(e) => {
                        setSelectedTaskForce(e.target.value);
                        if (e.target.value) setShowCreateTaskForce(false);
                      }}
                      className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
                    >
                      <option value="">Select task force...</option>
                      {taskForces.filter(tf => tf.status === "active").map((tf) => (
                        <option key={tf.id} value={tf.id}>{tf.name}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setShowCreateTaskForce(true)}
                    >
                      + CREATE NEW
                    </Button>
                  </div>

                  {showCreateTaskForce && (
                    <div className="p-4 bg-surface-3 border border-border-dim space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-orange uppercase tracking-wider">
                          Quick Create Task Force
                        </span>
                        <button
                          onClick={() => {
                            setShowCreateTaskForce(false);
                            setNewTFName("");
                            setNewTFMembers([]);
                          }}
                          className="font-mono text-[10px] text-dim hover:text-ink"
                        >
                          ✕ Close
                        </button>
                      </div>
                      
                      {task && (
                        <div className="text-[9px] text-ops/80 bg-ops/5 p-2 border border-ops/20">
                          Recommended based on task: "{task.substring(0, 50)}{task.length > 50 ? "..." : ""}"
                        </div>
                      )}
                      
                      <input
                        type="text"
                        value={newTFName}
                        onChange={(e) => setNewTFName(e.target.value)}
                        placeholder="Task Force Name (e.g., Alpha Team)"
                        className="w-full px-3 py-2 bg-surface-4 border-b border-border-dim border-l-3 border-l-ops font-body text-sm text-ink placeholder:text-dim focus:outline-none"
                      />
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={volunteerSearch}
                          onChange={(e) => {
                            setVolunteerSearch(e.target.value);
                            searchVolunteers(e.target.value, 0, true, true);
                          }}
                          placeholder="Search by name, skill, or equipment..."
                          className="flex-1 px-3 py-2 bg-surface-4 border-b border-border-dim border-l-3 border-l-dim font-body text-sm text-ink placeholder:text-dim focus:outline-none"
                        />
                      </div>
                      
                      <div className="text-[10px] text-dim uppercase tracking-wider">
                        Suggested members ({newTFMembers.length} selected) — Sorted by relevance
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {volunteerLoading ? (
                          <div className="text-center py-4 font-mono text-[11px] text-dim">
                            <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            Finding best volunteers...
                          </div>
                        ) : volunteerResults.length === 0 ? (
                          <div className="text-center py-4 font-mono text-[11px] text-dim">
                            {latitude && longitude 
                              ? "No volunteers found nearby. Try increasing search radius."
                              : "Set a location to find volunteers near the assignment."}
                          </div>
                        ) : (
                          volunteerResults.map((vol) => {
                            const isSelected = newTFMembers.includes(vol.id);
                            const score = vol.relevance_score || 0;
                            return (
                              <button
                                key={vol.id}
                                onClick={() => {
                                  setNewTFMembers(prev =>
                                    prev.includes(vol.id)
                                      ? prev.filter(id => id !== vol.id)
                                      : [...prev, vol.id]
                                  );
                                }}
                                className={`w-full flex items-center justify-between p-2 border transition-colors ${
                                  isSelected
                                    ? "bg-ops/10 border-ops border-l-3 border-l-ops"
                                    : "bg-surface-4 border-border-dim hover:border-dim"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 border ${isSelected ? "border-ops bg-ops" : "border-border-dim"} flex items-center justify-center`}>
                                    {isSelected && <span className="text-void text-[10px]">✓</span>}
                                  </div>
                                  <div>
                                    <div className="font-body text-[12px] text-ink">{vol.name}</div>
                                    <div className="flex items-center gap-2 font-mono text-[9px] text-dim">
                                      {Array.isArray(vol.skills) 
                                        ? vol.skills.slice(0, 2).map((s, i) => (
                                          <span key={i} className="text-ops/70">{String(s).trim()}</span>
                                        ))
                                        : typeof vol.skills === 'string'
                                        ? vol.skills.split(",").slice(0, 2).map((s, i) => (
                                          <span key={i} className="text-ops/70">{s.trim()}</span>
                                        ))
                                        : null}
                                      {Array.isArray(vol.equipment)
                                        ? vol.equipment.slice(0, 1).map((e, i) => (
                                          <span key={i} className="text-caution/70">{String(e).trim()}</span>
                                        ))
                                        : typeof vol.equipment === 'string'
                                        ? vol.equipment.split(",").slice(0, 1).map((e, i) => (
                                          <span key={i} className="text-caution/70">{e.trim()}</span>
                                        ))
                                        : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {vol.distance_km !== undefined && (
                                    <span className="font-mono text-[9px] text-ops">{vol.distance_km}km</span>
                                  )}
                                  {score > 0 && (
                                    <span className={`font-mono text-[9px] px-1.5 py-0.5 ${
                                      score >= 30 ? "bg-ops/20 text-ops" : "bg-surface-3 text-dim"
                                    }`}>
                                      +{score}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="primary"
                          size="small"
                          onClick={handleCreateTaskForce}
                          disabled={!newTFName.trim() || newTFMembers.length === 0 || creatingTF}
                        >
                          {creatingTF ? "Creating..." : `Create Task Force (${newTFMembers.length})`}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!showCreateTaskForce && taskForces.filter(tf => tf.status === "active").length === 0 && (
                    <div className="p-3 bg-ops/5 border border-ops/20">
                      <div className="font-mono text-[10px] text-ops uppercase mb-2">
                        No active task forces
                      </div>
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => {
                          searchVolunteers("", 0, true, true);
                          setShowCreateTaskForce(true);
                        }}
                      >
                        + Create Task Force
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                TIMER (optional)
              </label>
              <input
                type="datetime-local"
                value={timer}
                onChange={(e) => setTimer(e.target.value)}
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-mono text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                LINKED REPORT (optional)
              </label>
              <select
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value)}
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
              >
                <option value="">None</option>
                {victimReports.filter((r: any) => r.status === "open" || r.status === "active").map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.situation.toUpperCase()} — {r.city}, {r.district} ({r.urgency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              CANCEL
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isValid || loading}
            >
              {loading ? "CREATING..." : "CREATE ASSIGNMENT →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
