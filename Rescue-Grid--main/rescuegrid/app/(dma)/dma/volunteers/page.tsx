"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import CreateAssignmentModal from "@/components/dma/CreateAssignmentModal";
import RegisterVolunteerModal, { type RegisteredVolunteer } from "@/components/dma/RegisterVolunteerModal";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { formatRelative, useNow } from "@/hooks/useNow";
import { assignmentStatusLabel } from "@/lib/status";
import { parseList, type SkillCategory } from "@/lib/skills";
import { hasPlaceholderName, isNewVolunteer } from "@/lib/volunteers";

interface RosterVolunteer {
  id: string;
  name: string;
  mobile_no: string;
  type: string | null;
  status: string;
  tier: number | null;
  skills: string | null;
  equipment: string | null;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
  has_app: boolean;
  has_push: boolean;
  current_mission: {
    id: string;
    task: string;
    status: string;
    urgency: string | null;
    updated_at: string | null;
    task_force_name: string | null;
  } | null;
  last_message: { content: string; created_at: string } | null;
}

type Filter = "all" | "critical" | "new" | "available" | "on-mission" | "offline" | "no-app";
type Sort = "criticality" | "newest" | "name";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical / urgent" },
  { key: "new", label: "New" },
  { key: "available", label: "Available" },
  { key: "on-mission", label: "On mission" },
  { key: "offline", label: "Offline" },
  { key: "no-app", label: "No app" },
];

interface Criticality {
  rank: number;
  label: string;
  chip: string;
  border: string;
}

/**
 * How critical a volunteer's situation is right now: first by the urgency
 * of the mission they're on, then by whether they can be sent.
 */
function criticalityOf(v: { status: string; current_mission: { urgency: string | null } | null }): Criticality {
  const urgency = v.current_mission?.urgency;
  if (v.current_mission && urgency === "critical") {
    return { rank: 0, label: "🔴 Critical mission", chip: "bg-red-50 text-red-700 border border-red-200", border: "border-l-red-600" };
  }
  if (v.current_mission && urgency === "urgent") {
    return { rank: 1, label: "🟠 Urgent mission", chip: "bg-orange-50 text-orange-700 border border-orange-200", border: "border-l-orange" };
  }
  if (v.current_mission) {
    return { rank: 2, label: "🟡 On mission", chip: "bg-amber-50 text-amber-800 border border-amber-200", border: "border-l-amber-500" };
  }
  if (v.status === "active") {
    return { rank: 3, label: "🟢 Available now", chip: "bg-green-50 text-green-700 border border-green-200", border: "border-l-green-600" };
  }
  if (v.status === "standby") {
    return { rank: 4, label: "Standby", chip: "bg-gray-50 text-gray-600 border border-gray-200", border: "border-l-gray-400" };
  }
  return { rank: 5, label: "Offline", chip: "bg-gray-50 text-gray-500 border border-gray-200", border: "border-l-gray-300" };
}

function badgeFor(status: string) {
  if (status === "active") return { status: "ready", label: "AVAILABLE" };
  if (status === "on-mission") return { status: "on-mission", label: "ON MISSION" };
  if (status === "standby") return { status: "standby", label: "STANDBY" };
  return { status: "offline", label: "OFFLINE" };
}

function isFilter(value: string | null): value is Filter {
  return FILTERS.some((f) => f.key === value);
}

export default function VolunteersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <VolunteersContent />
    </Suspense>
  );
}

function VolunteersContent() {
  const now = useNow(30000);
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter");

  const [volunteers, setVolunteers] = useState<RosterVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>(isFilter(initialFilter) ? initialFilter : "all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("criticality");
  const [skillNames, setSkillNames] = useState<Record<string, string>>({});
  const [showRegister, setShowRegister] = useState(false);
  const [assignTo, setAssignTo] = useState<Pick<RosterVolunteer, "id" | "name" | "type" | "status"> | null>(null);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState("");

  const fetchRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/volunteers", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVolunteers(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch {
      setLoadError("Could not load volunteers — retrying on the next update.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoster();
    fetch("/api/skills")
      .then((res) => (res.ok ? res.json() : []))
      .then((cats: SkillCategory[]) => {
        const names: Record<string, string> = {};
        for (const cat of Array.isArray(cats) ? cats : []) for (const s of cat.skill_definitions) names[s.code] = s.name;
        setSkillNames(names);
      })
      .catch(() => {});
  }, [fetchRoster]);

  const scheduleRefetch = useDebouncedCallback(() => void fetchRoster(), 1000);

  useRealtimeSubscription<Record<string, unknown>>([
    {
      table: "volunteer",
      onInsert: scheduleRefetch,
      // Location pings arrive every 30s per volunteer — patch in place instead of refetching.
      onUpdate: (row) => {
        const v = row as Partial<RosterVolunteer> & { id: string; auth_id?: string | null; push_token?: string | null };
        setVolunteers((prev) =>
          prev.map((p) =>
            p.id === v.id
              ? {
                  ...p,
                  name: v.name ?? p.name,
                  status: v.status ?? p.status,
                  type: v.type ?? p.type,
                  skills: v.skills ?? p.skills,
                  equipment: v.equipment ?? p.equipment,
                  last_seen: v.last_seen ?? p.last_seen,
                  latitude: v.latitude ?? p.latitude,
                  longitude: v.longitude ?? p.longitude,
                  has_app: p.has_app || !!v.last_seen || !!v.push_token,
                  has_push: v.push_token !== undefined ? !!v.push_token : p.has_push,
                }
              : p
          )
        );
      },
      onDelete: scheduleRefetch,
    },
    { table: "assignment", onInsert: scheduleRefetch, onUpdate: scheduleRefetch },
    {
      table: "message",
      onInsert: (row) => {
        const m = row as { sender_type?: string; sender_id?: string | null; content?: string; created_at?: string };
        if (m.sender_type !== "volunteer" || !m.sender_id) return;
        setVolunteers((prev) =>
          prev.map((p) =>
            p.id === m.sender_id ? { ...p, last_message: { content: m.content || "", created_at: m.created_at || new Date().toISOString() } } : p
          )
        );
      },
    },
  ]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: volunteers.length, critical: 0, new: 0, available: 0, "on-mission": 0, offline: 0, "no-app": 0 };
    for (const v of volunteers) {
      if (criticalityOf(v).rank <= 1) c.critical++;
      if (isNewVolunteer(v.created_at, now)) c.new++;
      if (v.status === "active") c.available++;
      if (v.status === "on-mission") c["on-mission"]++;
      if (v.status === "offline") c.offline++;
      if (!v.has_app) c["no-app"]++;
    }
    return c;
  }, [volunteers, now]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return volunteers
      .filter((v) => {
        switch (filter) {
          case "critical": return criticalityOf(v).rank <= 1;
          case "new": return isNewVolunteer(v.created_at, now);
          case "available": return v.status === "active";
          case "on-mission": return v.status === "on-mission";
          case "offline": return v.status === "offline";
          case "no-app": return !v.has_app;
          default: return true;
        }
      })
      .filter((v) => {
        if (!q) return true;
        const skills = parseList(v.skills).map((code) => skillNames[code] || code).join(" ");
        return [v.name, v.mobile_no, v.type, skills, v.equipment].filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const joined = (v: RosterVolunteer) => (v.created_at ? new Date(v.created_at).getTime() : 0);
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "newest") return joined(b) - joined(a) || a.name.localeCompare(b.name);
        // Criticality: critical missions first … offline last. Within a level,
        // the most recently updated mission, then newcomers, then name.
        const rank = criticalityOf(a).rank - criticalityOf(b).rank;
        if (rank !== 0) return rank;
        const updated = (v: RosterVolunteer) => (v.current_mission?.updated_at ? new Date(v.current_mission.updated_at).getTime() : 0);
        return updated(b) - updated(a) || joined(b) - joined(a) || a.name.localeCompare(b.name);
      });
  }, [volunteers, filter, search, skillNames, sort, now]);

  const copyJoinLink = async () => {
    const link = `${window.location.origin}/volunteer/login`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link and share it (SMS, WhatsApp, posters):", link);
    }
  };

  const resetPin = async (v: RosterVolunteer) => {
    if (!window.confirm(`Give ${v.name} a new temporary PIN? Their old PIN stops working.`)) return;
    try {
      const res = await fetch(`/api/dma/volunteers/${v.id}/pin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reset the PIN");
      window.alert(
        `New PIN for ${data.name}: ${data.temp_pin}\n\nTell them to sign in at /volunteer/login with ${data.mobile_no} and this PIN, then change it in their profile.`
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Network error — please try again");
    }
  };

  const handleRegistered = (volunteer: RegisteredVolunteer, assignNow: boolean) => {
    setShowRegister(false);
    setFlash(`${volunteer.name} registered.`);
    setTimeout(() => setFlash(""), 4000);
    void fetchRoster();
    if (assignNow) setAssignTo({ id: volunteer.id, name: volunteer.name, type: volunteer.type, status: volunteer.status });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-[52px] p-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6 mt-6 flex-wrap">
          <div>
            <h1 className="font-inter text-[28px] font-bold uppercase tracking-wide text-gray-900">VOLUNTEERS</h1>
            <p className="font-ibm-mono text-[11px] text-gray-500 uppercase tracking-wider mt-1">
              {counts.all} REGISTERED · {counts.available} AVAILABLE · {counts["on-mission"]} ON MISSION
              {counts.critical > 0 && <span className="text-red-700"> · {counts.critical} ON CRITICAL/URGENT MISSIONS</span>}
              {counts.new > 0 && <span className="text-orange"> · {counts.new} NEW IN 48H</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={copyJoinLink} title="Anyone with this link can sign up with their phone number">
              {copied ? "✓ LINK COPIED" : "🔗 COPY JOIN LINK"}
            </Button>
            <Button variant="primary" onClick={() => setShowRegister(true)}>+ REGISTER WALK-IN</Button>
          </div>
        </div>

        <div className="mb-4 p-3 bg-white border border-gray-100 rounded-sm font-inter text-[12px] text-gray-600 leading-relaxed">
          <strong className="text-gray-900">Bringing in new volunteers:</strong> share the join link (or the “Join as a volunteer” button on the public
          page). People sign up with their phone number, add their skills, and appear here marked <span className="text-orange font-semibold">NEW</span>.
          For people without a smartphone, use <em>Register walk-in</em>, then assign tasks and call them. Log their progress from the Missions page.
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1.5 flex-wrap" role="tablist">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 font-ibm-mono text-[10px] uppercase tracking-wider border rounded-sm transition-colors ${
                  filter === key ? "bg-orange text-white border-orange" : "bg-white border-gray-200 text-gray-500 hover:border-orange"
                }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 font-ibm-mono text-[10px] uppercase tracking-wider text-gray-600">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="px-2 py-1.5 bg-white border border-gray-200 rounded-sm font-inter text-[12px] normal-case tracking-normal text-gray-900 focus:outline-none focus:border-orange"
            >
              <option value="criticality">Most critical first</option>
              <option value="newest">Newest first</option>
              <option value="name">Name</option>
            </select>
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, skill, equipment…"
            aria-label="Search volunteers"
            className="flex-1 min-w-[220px] px-3 py-1.5 bg-white border border-gray-200 rounded-sm font-inter text-[13px] focus:outline-none focus:border-orange"
          />
        </div>

        {flash && <p className="mb-3 font-ibm-mono text-[11px] text-green-700" role="status">{flash}</p>}
        {loadError && <p className="mb-3 font-ibm-mono text-[11px] text-red-600" role="alert">{loadError}</p>}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-white border border-gray-100 animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-[48px] mb-4 opacity-40">🙋</div>
            <p className="font-inter text-[13px] text-gray-500 uppercase tracking-wider">
              {search ? "NO VOLUNTEERS MATCH" : filter === "new" ? "NO NEW VOLUNTEERS IN THE LAST 48 HOURS" : "NO VOLUNTEERS HERE"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((v) => {
              const badge = badgeFor(v.status);
              const isNew = isNewVolunteer(v.created_at, now);
              const skills = parseList(v.skills).map((code) => skillNames[code] || code);
              const mission = v.current_mission;
              const profileIncomplete = v.has_app && (hasPlaceholderName(v.name) || skills.length === 0);
              const crit = criticalityOf(v);

              return (
                <div
                  key={v.id}
                  className={`bg-white border border-gray-100 border-l-4 rounded-sm shadow-sm p-4 ${crit.border}`}
                >
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-inter text-[14px] font-bold text-orange shrink-0">
                      {v.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-inter text-[14px] font-semibold text-gray-900">{v.name}</span>
                        <span className={`px-1.5 py-0.5 font-ibm-mono text-[10px] font-semibold uppercase rounded-sm ${crit.chip}`}>{crit.label}</span>
                        {isNew && <span className="px-1.5 py-0.5 bg-orange text-white font-ibm-mono text-[9px] uppercase rounded-sm">New</span>}
                        <StatusBadge status={badge.status} label={badge.label} size="sm" />
                        <span className="font-ibm-mono text-[10px] text-gray-500 uppercase">{v.type || "Individual"}</span>
                        {!v.has_app ? (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 font-ibm-mono text-[9px] uppercase rounded-sm" title="Hasn't used the volunteer app yet — reach them by phone">
                            📵 Not on app — call
                          </span>
                        ) : !v.has_push ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 font-ibm-mono text-[9px] uppercase rounded-sm" title="Won't get push alerts for new missions">
                            🔕 Alerts off
                          </span>
                        ) : null}
                        {profileIncomplete && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 font-ibm-mono text-[9px] uppercase rounded-sm">Profile incomplete</span>
                        )}
                      </div>

                      <div className="font-ibm-mono text-[10px] text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                        <a href={`tel:${v.mobile_no}`} className="text-orange hover:underline">📞 {v.mobile_no}</a>
                        {v.has_app && <span>📡 seen {v.last_seen ? formatRelative(v.last_seen, now) || "—" : "never"}</span>}
                        {v.created_at && <span>joined {formatRelative(v.created_at, now)}</span>}
                      </div>

                      {(skills.length > 0 || v.equipment) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {skills.slice(0, 6).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-green-50 text-green-700 font-ibm-mono text-[9px] uppercase rounded-sm">{s}</span>
                          ))}
                          {parseList(v.equipment).slice(0, 4).map((e) => (
                            <span key={e} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-ibm-mono text-[9px] uppercase rounded-sm">{e}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-[300px] shrink-0 space-y-1.5">
                      {mission ? (
                        <Link href={`/dma/assignments?open=${mission.id}`} className="block p-2 bg-amber-50 border border-amber-100 rounded-sm hover:border-amber-300">
                          <div className="font-ibm-mono text-[9px] text-amber-700 uppercase">
                            {assignmentStatusLabel(mission.status)}
                            {mission.task_force_name && ` · ${mission.task_force_name}`}
                            {mission.updated_at && ` · ${formatRelative(mission.updated_at, now)}`}
                          </div>
                          <div className="font-inter text-[12px] text-gray-900 line-clamp-1">{mission.task}</div>
                        </Link>
                      ) : (
                        <div className="p-2 bg-gray-50 border border-gray-100 rounded-sm font-ibm-mono text-[10px] text-gray-500 uppercase">No active mission</div>
                      )}
                      {v.last_message && (
                        <p className="font-inter text-[11px] text-gray-600 line-clamp-2" title={v.last_message.content}>
                          <span className="font-ibm-mono text-[9px] text-gray-500 uppercase">
                            last said {formatRelative(v.last_message.created_at, now)}:
                          </span>{" "}
                          {v.last_message.content}
                        </p>
                      )}
                    </div>

                    <div className="flex md:flex-col gap-1.5 shrink-0">
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => setAssignTo({ id: v.id, name: v.name, type: v.type, status: v.status })}
                        disabled={v.status === "offline"}
                        title={v.status === "offline" ? "This volunteer is offline" : undefined}
                      >
                        ASSIGN TASK
                      </Button>
                      <Link
                        href={`/dma/messages?volunteer=${v.id}`}
                        className="px-3 py-1.5 text-center border border-gray-200 bg-white font-ibm-mono text-[10px] uppercase tracking-wider text-gray-600 hover:border-orange hover:text-orange rounded-sm"
                      >
                        MESSAGE
                      </Link>
                      <button
                        type="button"
                        onClick={() => void resetPin(v)}
                        className="px-3 py-1.5 text-center border border-gray-200 bg-white font-ibm-mono text-[10px] uppercase tracking-wider text-gray-600 hover:border-orange hover:text-orange rounded-sm"
                        title="Give this volunteer a new temporary PIN (forgotten PIN)"
                      >
                        RESET PIN
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showRegister && <RegisterVolunteerModal onClose={() => setShowRegister(false)} onRegistered={handleRegistered} />}
      {assignTo && (
        <CreateAssignmentModal
          presetVolunteer={assignTo}
          onClose={() => setAssignTo(null)}
          onCreated={() => void fetchRoster()}
        />
      )}
    </div>
  );
}
