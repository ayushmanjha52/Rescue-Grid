"use client";

import { useState, useEffect, useRef } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { MAPBOX_TOKEN } from "@/lib/config";
import { EQUIPMENT_OPTIONS, parseList, type SkillCategory } from "@/lib/skills";
import { useNow } from "@/hooks/useNow";
import type { Urgency } from "@/lib/status";

interface VolunteerOption {
  id: string;
  name: string;
  type: string | null;
  status: string;
  skills?: string | string[] | null;
  equipment?: string | string[] | null;
  distance_km?: number;
  score?: number;
  tier?: number | null;
}

interface TaskForce {
  id: string;
  name: string;
  status: string;
  member_count?: number;
}

interface VictimReportOption {
  id: string;
  situation: string;
  city: string | null;
  district: string | null;
  urgency: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  custom_message: string | null;
}

interface GeocodeFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

interface CreateAssignmentModalProps {
  linkedReportId?: string | null;
  /** Opens the modal with this volunteer already chosen (e.g. from the roster). */
  presetVolunteer?: Pick<VolunteerOption, "id" | "name" | "type" | "status"> | null;
  onClose: () => void;
  onCreated?: () => void;
}

const VOLUNTEER_STATUS_OPTIONS = [
  { value: "active", label: "Ready" },
  { value: "standby", label: "Standby" },
  { value: "all", label: "All" },
];

const PAGE_SIZE = 50;

/** yyyy-MM-ddTHH:mm in local time, for datetime-local inputs. */
function toLocalInputValue(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function volunteerBadge(status: string): "ready" | "on-mission" | "standby" {
  if (status === "active") return "ready";
  if (status === "on-mission") return "on-mission";
  return "standby";
}

export default function CreateAssignmentModal({ linkedReportId, presetVolunteer, onClose, onCreated }: CreateAssignmentModalProps) {
  useEscapeKey(onClose);
  const now = useNow(60000);
  const [task, setTask] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("moderate");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [assigneeType, setAssigneeType] = useState<"volunteer" | "taskforce" | null>(presetVolunteer ? "volunteer" : null);
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerOption | null>(presetVolunteer ?? null);
  const [selectedTaskForce, setSelectedTaskForce] = useState("");
  const [timer, setTimer] = useState("");
  const [selectedReport, setSelectedReport] = useState(linkedReportId || "");
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const locationTypedRef = useRef(false);

  const [taskForces, setTaskForces] = useState<TaskForce[]>([]);
  const [taskForcesLoaded, setTaskForcesLoaded] = useState(false);
  const [victimReports, setVictimReports] = useState<VictimReportOption[]>([]);
  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);

  // Volunteer search
  const [volunteerSearch, setVolunteerSearch] = useState("");
  const [volunteerResults, setVolunteerResults] = useState<VolunteerOption[]>([]);
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [showVolunteerDropdown, setShowVolunteerDropdown] = useState(false);
  const [volunteerPage, setVolunteerPage] = useState(0);
  const [volunteerHasMore, setVolunteerHasMore] = useState(false);
  const [volunteerTotal, setVolunteerTotal] = useState(0);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [volunteerStatusFilter, setVolunteerStatusFilter] = useState("active");
  const [searchRadius, setSearchRadius] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  // Inline task force creation
  const [showCreateTaskForce, setShowCreateTaskForce] = useState(false);
  const [newTFName, setNewTFName] = useState("");
  const [newTFMembers, setNewTFMembers] = useState<VolunteerOption[]>([]);
  const [creatingTF, setCreatingTF] = useState(false);

  const activeTaskForces = taskForces.filter((tf) => tf.status === "active");

  // Initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/dma/taskforce/list").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/victim/reports").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/skills").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([tfs, reports, skills]) => {
      setTaskForces(Array.isArray(tfs) ? tfs : []);
      setTaskForcesLoaded(true);
      setSkillCategories(Array.isArray(skills) ? skills : []);
      const reportList: VictimReportOption[] = Array.isArray(reports) ? reports : [];
      setVictimReports(reportList);

      // Pre-fill from the linked report.
      const report = linkedReportId ? reportList.find((r) => r.id === linkedReportId) : undefined;
      if (report) {
        if (report.latitude != null && report.longitude != null) {
          setLatitude(report.latitude);
          setLongitude(report.longitude);
          setLocationLabel(
            [report.city, report.district].filter(Boolean).join(", ") ||
              `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
          );
        }
        if (report.urgency === "critical" || report.urgency === "urgent" || report.urgency === "moderate") {
          setUrgency(report.urgency);
        }
        setTask(
          `Respond to ${report.situation} report${report.custom_message ? `: ${report.custom_message}` : ""}`.slice(0, 500)
        );
      }
    });
  }, [linkedReportId]);

  // Location autocomplete — only for text the operator typed.
  useEffect(() => {
    if (!locationTypedRef.current || !MAPBOX_TOKEN) return;
    const query = locationLabel.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&country=in`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch {
        // aborted / offline
      }
    }, 300);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [locationLabel]);

  const searchingVolunteers = assigneeType === "volunteer" || (assigneeType === "taskforce" && showCreateTaskForce);

  // One debounced, cancellable volunteer search for every input that affects it.
  useEffect(() => {
    if (!searchingVolunteers) return;
    const controller = new AbortController();

    const id = setTimeout(async () => {
      setVolunteerLoading(true);
      try {
        if (latitude !== null && longitude !== null) {
          const res = await fetch("/api/volunteer/search/scored", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude,
              longitude,
              radius_km: searchRadius,
              limit: 100,
              status: volunteerStatusFilter,
              skill_codes: selectedSkills,
              equipment: selectedEquipment,
            }),
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            const query = volunteerSearch.trim().toLowerCase();
            const results: VolunteerOption[] = (data.volunteers || []).filter(
              (v: VolunteerOption) => !query || v.name.toLowerCase().includes(query)
            );
            setVolunteerResults(results);
            setVolunteerTotal(results.length);
            setVolunteerHasMore(false);
          }
        } else {
          const params = new URLSearchParams({
            status: volunteerStatusFilter,
            limit: String(PAGE_SIZE),
            offset: String(volunteerPage * PAGE_SIZE),
          });
          if (volunteerSearch.trim()) params.set("q", volunteerSearch.trim());
          if (selectedSkills.length > 0) params.set("skills", selectedSkills.join(","));
          if (selectedEquipment.length > 0) params.set("equipment", selectedEquipment.join(","));

          const res = await fetch(`/api/volunteer/search?${params.toString()}`, { signal: controller.signal });
          if (res.ok) {
            const data = await res.json();
            const page: VolunteerOption[] = data.data || [];
            setVolunteerResults((prev) => (volunteerPage === 0 ? page : [...prev, ...page]));
            setVolunteerHasMore(Boolean(data.hasMore));
            setVolunteerTotal(data.total || 0);
          }
        }
      } catch {
        // aborted / offline
      } finally {
        if (!controller.signal.aborted) setVolunteerLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [searchingVolunteers, latitude, longitude, searchRadius, volunteerStatusFilter, selectedSkills, selectedEquipment, volunteerSearch, volunteerPage]);

  const resetPaging = () => setVolunteerPage(0);

  const handleSelectSuggestion = (place: GeocodeFeature) => {
    locationTypedRef.current = false;
    setLocationLabel(place.place_name);
    setLatitude(place.center[1]);
    setLongitude(place.center[0]);
    setShowSuggestions(false);
    setSuggestions([]);
    resetPaging();
  };

  const handleClearLocation = () => {
    locationTypedRef.current = false;
    setLocationLabel("");
    setLatitude(null);
    setLongitude(null);
    setSuggestions([]);
    setShowSuggestions(false);
    resetPaging();
  };

  const chooseAssigneeType = (type: "volunteer" | "taskforce") => {
    setAssigneeType(type);
    setError("");
    resetPaging();
    if (type === "volunteer") {
      setSelectedTaskForce("");
    } else {
      setSelectedVolunteer(null);
      if (taskForcesLoaded && activeTaskForces.length === 0) setShowCreateTaskForce(true);
    }
  };

  const handleCreateTaskForce = async () => {
    if (!newTFName.trim() || newTFMembers.length === 0) return;
    setCreatingTF(true);
    setError("");
    try {
      const res = await fetch("/api/dma/taskforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTFName.trim(), member_ids: newTFMembers.map((m) => m.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create task force");
      }
      const newTF = await res.json();
      setTaskForces((prev) => [{ id: newTF.id, name: newTF.name, status: "active", member_count: newTFMembers.length }, ...prev]);
      setSelectedTaskForce(newTF.id);
      setShowCreateTaskForce(false);
      setNewTFName("");
      setNewTFMembers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task force");
    } finally {
      setCreatingTF(false);
    }
  };

  const minDeadline = now ? toLocalInputValue(now) : undefined;

  const isValid =
    task.trim() &&
    locationLabel.trim() &&
    latitude !== null &&
    longitude !== null &&
    ((assigneeType === "volunteer" && selectedVolunteer) || (assigneeType === "taskforce" && selectedTaskForce));

  const handleSubmit = async () => {
    if (!isValid) return;

    let deadline: string | null = null;
    if (timer) {
      // datetime-local has no zone — interpret it in the operator's local time.
      const parsed = new Date(timer);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now()) {
        setError("The deadline must be in the future");
        return;
      }
      deadline = parsed.toISOString();
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dma/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task.trim(),
          urgency,
          location_label: locationLabel.trim(),
          latitude,
          longitude,
          victim_report_id: selectedReport || null,
          timer: deadline,
          ...(assigneeType === "volunteer"
            ? { assigned_to_volunteer: selectedVolunteer!.id }
            : { assigned_to_taskforce: selectedTaskForce }),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create assignment");
      }

      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const linkableReports = victimReports.filter(
    (r) => r.id === selectedReport || ["open", "verified", "assigned", "en_route", "arrived"].includes(r.status)
  );

  const renderSkills = (vol: VolunteerOption, count = 2) =>
    parseList(vol.skills).slice(0, count).map((s) => (
      <span key={s} className="text-ops">{s}</span>
    ));

  const filtersActive = selectedSkills.length + selectedEquipment.length;

  const filterPanel = showFilters && (
    <div className="p-3 bg-surface-3 border border-border-dim space-y-3">
      {latitude !== null && longitude !== null && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-dim uppercase">Distance: {searchRadius}km</span>
          <input
            type="range"
            min="5"
            max="200"
            step="5"
            value={searchRadius}
            onChange={(e) => {
              setSearchRadius(Number.parseInt(e.target.value, 10));
              resetPaging();
            }}
            className="w-32 accent-orange"
            aria-label="Search radius"
          />
        </div>
      )}

      <div>
        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Status</span>
        <div className="flex gap-2">
          {VOLUNTEER_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setVolunteerStatusFilter(opt.value);
                resetPaging();
              }}
              className={`px-2 py-1 font-mono text-[9px] uppercase transition-colors ${
                volunteerStatusFilter === opt.value ? "bg-orange text-white" : "bg-surface-4 text-dim hover:text-ink"
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
          {skillCategories.flatMap((cat) => cat.skill_definitions).map((skill) => (
            <button
              key={skill.code}
              type="button"
              onClick={() => {
                setSelectedSkills((prev) => (prev.includes(skill.code) ? prev.filter((s) => s !== skill.code) : [...prev, skill.code]));
                resetPaging();
              }}
              className={`px-2 py-0.5 font-mono text-[9px] uppercase transition-colors ${
                selectedSkills.includes(skill.code) ? "bg-ops text-white" : "bg-surface-4 text-dim hover:text-ink"
              }`}
            >
              {skill.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="font-mono text-[9px] text-dim uppercase block mb-1">Equipment</span>
        <div className="flex flex-wrap gap-1">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq.value}
              type="button"
              onClick={() => {
                setSelectedEquipment((prev) => (prev.includes(eq.value) ? prev.filter((e) => e !== eq.value) : [...prev, eq.value]));
                resetPaging();
              }}
              className={`px-2 py-0.5 font-mono text-[9px] uppercase transition-colors ${
                selectedEquipment.includes(eq.value) ? "bg-ops text-white" : "bg-surface-4 text-dim hover:text-ink"
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>

      {(filtersActive > 0 || volunteerStatusFilter !== "active") && (
        <button
          type="button"
          onClick={() => {
            setSelectedSkills([]);
            setSelectedEquipment([]);
            setVolunteerStatusFilter("active");
            resetPaging();
          }}
          className="font-mono text-[9px] text-orange hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-assignment-title"
    >
      <div className="w-[700px] max-w-full max-h-[90vh] overflow-y-auto bg-surface-2 border-t-[2px] border-orange clip-path-tactical">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="create-assignment-title" className="font-display text-[24px] font-bold uppercase tracking-wide text-ink">
              CREATE ASSIGNMENT
            </h2>
            <button onClick={onClose} className="font-mono text-[11px] text-dim uppercase tracking-wider hover:text-ink transition-colors">
              ✕ CLOSE
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-alert/10 border border-alert/30 font-mono text-[11px] text-alert" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="assignment-task" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                TASK DESCRIPTION *
              </label>
              <textarea
                id="assignment-task"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Rescue 30 civilians at riverbank sector 4..."
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange resize-none"
              />
            </div>

            <div className="relative">
              <label htmlFor="assignment-location" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                LOCATION *
              </label>
              <div className="relative">
                <input
                  id="assignment-location"
                  type="text"
                  value={locationLabel}
                  onChange={(e) => {
                    locationTypedRef.current = true;
                    setLocationLabel(e.target.value);
                    setLatitude(null);
                    setLongitude(null);
                  }}
                  autoComplete="off"
                  placeholder="Search for a location..."
                  className="w-full px-3 py-2 pr-8 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange"
                />
                {locationLabel && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-dim hover:text-ink"
                    aria-label="Clear location"
                  >
                    ✕
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-surface-3 border border-border-dim shadow-xl max-h-48 overflow-y-auto">
                  {suggestions.map((place) => (
                    <button
                      key={place.id}
                      type="button"
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
              {latitude !== null && longitude !== null ? (
                <div className="mt-1 font-mono text-[10px] text-ops">
                  ✓ Coordinates set: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </div>
              ) : locationLabel.trim() ? (
                <div className="mt-1 font-mono text-[10px] text-caution">Pick a suggestion to set coordinates</div>
              ) : null}
            </div>

            <div>
              <span className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-2">URGENCY *</span>
              <div className="flex gap-3" role="radiogroup" aria-label="Urgency">
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
                    <span className={`font-mono text-[11px] uppercase tracking-wider ${urgency === level ? "text-orange" : "text-dim"}`}>
                      {level}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-2">ASSIGN TO *</span>
              <div className="flex gap-6 mb-3" role="radiogroup" aria-label="Assign to">
                {(["volunteer", "taskforce"] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assigneeType"
                      value={type}
                      checked={assigneeType === type}
                      onChange={() => chooseAssigneeType(type)}
                      className="accent-orange"
                    />
                    <span className={`font-mono text-[11px] uppercase tracking-wider ${assigneeType === type ? "text-orange" : "text-dim"}`}>
                      {type === "volunteer" ? "Individual Volunteer" : "Task Force"}
                    </span>
                  </label>
                ))}
              </div>

              {assigneeType === "volunteer" && (
                <div className="space-y-3">
                  {selectedVolunteer ? (
                    <div className="p-2 bg-ops/10 border border-ops/30 flex items-center justify-between">
                      <span className="font-body text-[13px] text-ink">
                        Selected: <strong>{selectedVolunteer.name}</strong>
                        {selectedVolunteer.distance_km !== undefined && ` · ${selectedVolunteer.distance_km}km away`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVolunteer(null);
                          setShowVolunteerDropdown(true);
                        }}
                        className="font-mono text-[10px] text-dim hover:text-alert"
                      >
                        ✕ Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={volunteerSearch}
                          onChange={(e) => {
                            setVolunteerSearch(e.target.value);
                            resetPaging();
                            setShowVolunteerDropdown(true);
                          }}
                          onFocus={() => setShowVolunteerDropdown(true)}
                          placeholder="Search volunteers by name..."
                          aria-label="Search volunteers"
                          className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFilters(!showFilters)}
                          aria-expanded={showFilters}
                          className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                            showFilters ? "bg-orange text-white" : "bg-surface-3 text-dim hover:text-ink"
                          }`}
                        >
                          ⚙ Filters {filtersActive > 0 && `(${filtersActive})`}
                        </button>
                      </div>

                      {filterPanel}

                      {showVolunteerDropdown && (
                        <div className="max-h-80 overflow-y-auto bg-surface-3 border border-border-dim">
                          {volunteerLoading && volunteerResults.length === 0 ? (
                            <div className="p-4 text-center font-mono text-[11px] text-dim">
                              <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              Loading volunteers...
                            </div>
                          ) : volunteerResults.length === 0 ? (
                            <div className="p-4 text-center font-mono text-[11px] text-dim">
                              {volunteerSearch || filtersActive > 0
                                ? "No volunteers match your filters"
                                : latitude !== null
                                  ? "No volunteers within range. Increase the distance in Filters."
                                  : "No volunteers found"}
                            </div>
                          ) : (
                            <>
                              <div className="sticky top-0 bg-surface-4 px-3 py-2 font-mono text-[9px] text-dim border-b border-border-dim flex items-center justify-between">
                                <span>{volunteerTotal} volunteers · showing {volunteerResults.length}</span>
                                {latitude !== null && <span className="text-ops">Ranked by skill, distance &amp; availability</span>}
                              </div>
                              {volunteerResults.map((vol) => (
                                <button
                                  key={vol.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedVolunteer(vol);
                                    setShowVolunteerDropdown(false);
                                  }}
                                  className="w-full flex items-center justify-between p-3 border-b border-border-dim/50 last:border-b-0 transition-colors hover:bg-surface-4 text-left"
                                >
                                  <div>
                                    <div className="font-body text-[13px] text-ink font-semibold">{vol.name}</div>
                                    <div className="flex items-center gap-2 font-mono text-[10px] text-dim">
                                      <span>{vol.type || "Individual"}</span>
                                      {vol.tier && <span>T{vol.tier}</span>}
                                      {renderSkills(vol)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {vol.score !== undefined && (
                                      <span className="font-mono text-[10px] text-ops font-bold" title="Match score">
                                        {Math.round(vol.score * 100)}%
                                      </span>
                                    )}
                                    {vol.distance_km !== undefined && (
                                      <span className={`font-mono text-[10px] ${vol.distance_km < 10 ? "text-ops font-bold" : "text-dim"}`}>
                                        {vol.distance_km < 1 ? "<1km" : `${vol.distance_km}km`}
                                      </span>
                                    )}
                                    <StatusBadge status={volunteerBadge(vol.status)} />
                                  </div>
                                </button>
                              ))}
                              {volunteerHasMore && (
                                <button
                                  type="button"
                                  onClick={() => setVolunteerPage((p) => p + 1)}
                                  disabled={volunteerLoading}
                                  className="w-full py-2 font-mono text-[11px] text-orange hover:bg-surface-4 transition-colors"
                                >
                                  {volunteerLoading ? "Loading..." : `Load more (${volunteerTotal - volunteerResults.length} remaining)`}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
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
                      aria-label="Task force"
                      className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
                    >
                      <option value="">Select task force...</option>
                      {activeTaskForces.map((tf) => (
                        <option key={tf.id} value={tf.id}>
                          {tf.name}{tf.member_count ? ` (${tf.member_count} members)` : ""}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" size="small" onClick={() => {
                      setShowCreateTaskForce(true);
                      resetPaging();
                    }}>
                      + CREATE NEW
                    </Button>
                  </div>

                  {showCreateTaskForce && (
                    <div className="p-4 bg-surface-3 border border-border-dim space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-orange uppercase tracking-wider">Quick Create Task Force</span>
                        <button
                          type="button"
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

                      <input
                        type="text"
                        value={newTFName}
                        onChange={(e) => setNewTFName(e.target.value)}
                        placeholder="Task Force Name (e.g., Alpha Team)"
                        aria-label="Task force name"
                        maxLength={80}
                        className="w-full px-3 py-2 bg-surface-4 border-b border-border-dim border-l-3 border-l-ops font-body text-sm text-ink placeholder:text-dim focus:outline-none"
                      />

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={volunteerSearch}
                          onChange={(e) => {
                            setVolunteerSearch(e.target.value);
                            resetPaging();
                          }}
                          placeholder="Search by name..."
                          aria-label="Search members"
                          className="flex-1 px-3 py-2 bg-surface-4 border-b border-border-dim border-l-3 border-l-dim font-body text-sm text-ink placeholder:text-dim focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFilters(!showFilters)}
                          className={`px-3 py-2 font-mono text-[11px] uppercase ${showFilters ? "bg-orange text-white" : "bg-surface-4 text-dim"}`}
                        >
                          ⚙ {filtersActive > 0 ? `(${filtersActive})` : ""}
                        </button>
                      </div>

                      {filterPanel}

                      <div className="text-[10px] text-dim uppercase tracking-wider">
                        {newTFMembers.length} selected{latitude !== null ? " · best matches first" : ""}
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {volunteerLoading && volunteerResults.length === 0 ? (
                          <div className="text-center py-4 font-mono text-[11px] text-dim">Finding volunteers...</div>
                        ) : volunteerResults.length === 0 ? (
                          <div className="text-center py-4 font-mono text-[11px] text-dim">No volunteers match.</div>
                        ) : (
                          volunteerResults.map((vol) => {
                            const isSelected = newTFMembers.some((m) => m.id === vol.id);
                            return (
                              <button
                                key={vol.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() =>
                                  setNewTFMembers((prev) => (isSelected ? prev.filter((m) => m.id !== vol.id) : [...prev, vol]))
                                }
                                className={`w-full flex items-center justify-between p-2 border transition-colors text-left ${
                                  isSelected ? "bg-ops/10 border-ops" : "bg-surface-4 border-border-dim hover:border-dim"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 border ${isSelected ? "border-ops bg-ops" : "border-border-dim"} flex items-center justify-center`}>
                                    {isSelected && <span className="text-white text-[10px]">✓</span>}
                                  </div>
                                  <div>
                                    <div className="font-body text-[12px] text-ink">{vol.name}</div>
                                    <div className="flex items-center gap-2 font-mono text-[9px] text-dim">{renderSkills(vol)}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {vol.distance_km !== undefined && <span className="font-mono text-[9px] text-ops">{vol.distance_km}km</span>}
                                  {vol.score !== undefined && <span className="font-mono text-[9px] px-1.5 py-0.5 bg-ops/20 text-ops">{Math.round(vol.score * 100)}%</span>}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="primary"
                        size="small"
                        onClick={handleCreateTaskForce}
                        disabled={!newTFName.trim() || newTFMembers.length === 0 || creatingTF}
                      >
                        {creatingTF ? "Creating..." : `Create Task Force (${newTFMembers.length})`}
                      </Button>
                    </div>
                  )}

                  {!showCreateTaskForce && taskForcesLoaded && activeTaskForces.length === 0 && (
                    <p className="font-mono text-[10px] text-ops uppercase">No active task forces — create one above.</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="assignment-deadline" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                DEADLINE (optional)
              </label>
              <input
                id="assignment-deadline"
                type="datetime-local"
                value={timer}
                min={minDeadline}
                onChange={(e) => setTimer(e.target.value)}
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-mono text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
              />
            </div>

            <div>
              <label htmlFor="assignment-report" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
                LINKED REPORT (optional)
              </label>
              <select
                id="assignment-report"
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value)}
                className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink focus:outline-none focus:bg-surface-4 focus:border-orange"
              >
                <option value="">None</option>
                {linkableReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.situation.toUpperCase()} — {[r.city, r.district].filter(Boolean).join(", ") || "Unknown"} ({r.urgency}, {r.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              CANCEL
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={!isValid || loading}>
              {loading ? "CREATING..." : "CREATE ASSIGNMENT →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
