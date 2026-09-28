'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import MissionTimeline from '@/components/shared/MissionTimeline';
import { createClient } from '@/lib/supabase/client';
import { formatCountdown, useNow } from '@/hooks/useNow';
import { assignmentStatusLabel, MAX_MISSION_NOTE_LENGTH, normalizeAssignmentStatus } from '@/lib/status';

const QUICK_NOTES = [
  'Road blocked, taking another route',
  'Need more hands',
  'Need medical support',
  'Need a boat / vehicle',
  'People found and safe',
];

interface Assignment {
  id: string;
  task: string;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  urgency: string;
  status: string;
  assigned_to_volunteer: string | null;
  assigned_to_taskforce: string | null;
  victim_report_id: string | null;
  timer: string | null;
  created_at: string;
  updated_at: string;
  victim_report?: { situation: string; custom_message: string | null } | null;
}

interface TFMember {
  id: string;
  name: string;
  type: string | null;
  status: string;
  role: string | null;
}

interface TaskForceDetails {
  id: string;
  name: string;
  members: TFMember[];
}

function statusColor(status: string) {
  switch (normalizeAssignmentStatus(status)) {
    case 'active': return 'bg-intel text-white';
    case 'en_route': return 'bg-orange text-white';
    case 'arrived': return 'bg-ops text-white';
    default: return 'bg-surface-3 text-muted';
  }
}

function urgencyColor(urgency: string) {
  switch (urgency) {
    case 'critical': return 'text-alert';
    case 'urgent': return 'text-orange';
    default: return 'text-caution';
  }
}

function typeBadgeColor(type: string | null) {
  switch (type?.toLowerCase()) {
    case 'police': return 'bg-blue-accent/20 text-blue-accent';
    case 'ndrf': return 'bg-ops/20 text-ops';
    case 'ngo': return 'bg-purple/20 text-purple';
    default: return 'bg-surface-3 text-dim';
  }
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ActiveMissionPage() {
  const router = useRouter();
  const now = useNow(1000);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [taskForce, setTaskForce] = useState<TaskForceDetails | null>(null);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const fetchActiveAssignment = useCallback(async () => {
    try {
      const res = await fetch('/api/volunteer/assignment/active', { cache: 'no-store' });
      if (res.ok) setAssignment(await res.json());
    } catch {
      // offline — keep what we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveAssignment();

    // Refresh when the app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchActiveAssignment();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchActiveAssignment]);

  // Live updates to this mission (e.g. DMA closes it).
  const assignmentId = assignment?.id;
  useEffect(() => {
    if (!assignmentId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`active-mission-${assignmentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignment', filter: `id=eq.${assignmentId}` }, () => {
        void fetchActiveAssignment();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, fetchActiveAssignment]);

  const taskForceId = assignment?.assigned_to_taskforce;
  useEffect(() => {
    if (!taskForceId) return;
    let cancelled = false;
    fetch(`/api/volunteer/taskforces/${taskForceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setTaskForce(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskForceId]);

  const updateStatus = async (newStatus: 'en_route' | 'arrived' | 'completed' | 'failed') => {
    if (!assignment) return;
    const trimmedNote = note.trim();
    if (newStatus === 'failed' && !trimmedNote) {
      setError('Write a short reason in the update box so Command can re-assign the mission.');
      noteRef.current?.focus();
      return;
    }
    if (newStatus === 'completed' && !window.confirm('Mark this mission as COMPLETED?')) return;
    if (newStatus === 'failed' && !window.confirm('Report this mission as FAILED? DMA will be alerted to re-assign it.')) return;

    setUpdating(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/volunteer/assignment/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note: trimmedNote || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update the mission');
      }
      setNote('');
      if (newStatus === 'completed' || newStatus === 'failed') {
        router.push('/volunteer/missions');
        return;
      }
      setTimelineKey((k) => k + 1);
      await fetchActiveAssignment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again');
    }
    setUpdating(false);
  };

  const sendUpdate = async () => {
    if (!assignment) return;
    const content = note.trim();
    if (!content) {
      noteRef.current?.focus();
      return;
    }
    setUpdating(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/volunteer/assignment/${assignment.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, flag: urgent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send the update');
      }
      setNote('');
      setUrgent(false);
      setNotice(urgent ? 'Sent — Command has been alerted.' : 'Update sent to Command.');
      setTimelineKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again');
    }
    setUpdating(false);
  };

  const addQuickNote = (text: string) => {
    setNote((prev) => (prev.trim() ? `${prev.trim()}. ${text}` : text).slice(0, MAX_MISSION_NOTE_LENGTH));
    noteRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-dim text-xs">LOADING MISSION...</span>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <p className="font-display text-lg text-ink mb-2">NO ACTIVE MISSION</p>
          <p className="font-mono text-[11px] text-dim mb-6">Check the queue for new assignments</p>
          <Button variant="secondary" onClick={() => router.push('/volunteer/missions')}>
            VIEW QUEUE
          </Button>
        </div>
      </div>
    );
  }

  const status = normalizeAssignmentStatus(assignment.status);
  const countdown = formatCountdown(assignment.timer, now);
  const members = taskForce?.members ?? [];

  return (
    <div className="min-h-screen bg-void">
      <div className="bg-surface-1 border-b border-border-dim p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-orange">
              MISSION-{assignment.id.slice(0, 8).toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 font-mono text-[9px] font-semibold ${statusColor(assignment.status)}`}>
              {assignmentStatusLabel(assignment.status)}
            </span>
          </div>
          <span className={`font-mono text-[10px] uppercase ${urgencyColor(assignment.urgency)}`}>
            {assignment.urgency}
          </span>
        </div>

        <h1 className="font-display text-xl font-semibold text-ink leading-tight mb-4 whitespace-pre-wrap">
          {assignment.task}
        </h1>

        {assignment.victim_report?.custom_message && (
          <div className="mb-4 p-3 bg-alert/5 border-l-2 border-alert">
            <p className="font-mono text-[9px] text-alert uppercase tracking-wider mb-1">
              Victim report · {assignment.victim_report.situation}
            </p>
            <p className="font-body text-[13px] text-ink italic">&ldquo;{assignment.victim_report.custom_message}&rdquo;</p>
          </div>
        )}

        <div className="bg-surface-2 p-3 mb-4" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
          <div className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange mt-0.5 shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <div className="flex-1">
              <p className="text-ink font-body text-[13px]">
                {assignment.location_label || 'Location not specified'}
              </p>
              {assignment.latitude != null && assignment.longitude != null && (
                <p className="font-mono text-[10px] text-dim mt-1">
                  {assignment.latitude.toFixed(6)}, {assignment.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
          {countdown && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-dim">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={countdown === '00:00:00' ? 'text-alert' : 'text-caution'}>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <span className={`font-mono text-[12px] ${countdown === '00:00:00' ? 'text-alert' : 'text-caution'}`}>{countdown}</span>
              <span className="font-mono text-[10px] text-dim">{countdown === '00:00:00' ? 'deadline passed' : 'remaining'}</span>
            </div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="mission-note" className="font-mono text-[10px] text-dim uppercase tracking-wider block mb-1">
            Update for Command
          </label>
          <textarea
            id="mission-note"
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={MAX_MISSION_NOTE_LENGTH}
            placeholder="What's happening? Sent with the next status change, or tap SEND UPDATE."
            className="w-full px-3 py-2 bg-surface-2 border border-border-dim font-body text-[13px] text-ink placeholder:text-dim focus:outline-none focus:border-orange resize-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {QUICK_NOTES.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => addQuickNote(text)}
                className="px-2 py-1 bg-surface-3 text-dim hover:text-ink font-mono text-[9px] uppercase tracking-wide"
              >
                + {text}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <label className="flex items-center gap-2 font-mono text-[10px] text-alert uppercase cursor-pointer">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="accent-alert" />
              ⚑ Urgent — alert Command
            </label>
            <Button variant="ghost" size="small" onClick={sendUpdate} disabled={updating || !note.trim()}>
              SEND UPDATE
            </Button>
          </div>
        </div>

        {error && <p className="mb-2 font-mono text-[11px] text-alert" role="alert">{error}</p>}
        {notice && <p className="mb-2 font-mono text-[11px] text-ops" role="status">{notice}</p>}

        <div className="flex gap-2">
          {status === 'active' && (
            <Button variant="secondary" onClick={() => updateStatus('en_route')} disabled={updating} className="flex-1">
              ACCEPT & START
            </Button>
          )}
          {status === 'en_route' && (
            <Button variant="secondary" onClick={() => updateStatus('arrived')} disabled={updating} className="flex-1">
              ARRIVED AT SITE
            </Button>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            variant="primary"
            onClick={() => updateStatus('completed')}
            disabled={updating}
            className="flex-1 bg-ops hover:bg-ops/90"
          >
            ✓ COMPLETE
          </Button>
          <Button
            variant="danger"
            onClick={() => updateStatus('failed')}
            disabled={updating}
            className="flex-1"
          >
            ✗ FAILED
          </Button>
        </div>
      </div>

      {taskForce && (
        <div className="p-4 border-b border-border-dim">
          <div className="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span className="font-display text-[13px] font-semibold text-ink uppercase tracking-wide">
              {taskForce.name}
            </span>
            <span className="font-mono text-[10px] text-dim">({members.length} members)</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {members.slice(0, 6).map((member) => (
              <div key={member.id} className="flex items-center gap-2 bg-surface-2 px-2 py-1.5"
                   style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  member.status === 'active' || member.status === 'on-mission' ? 'bg-ops/20 text-ops' : 'bg-surface-3 text-dim'
                }`}>
                  {initials(member.name)}
                </div>
                <span className="font-body text-[11px] text-ink">{member.name.split(' ')[0]}</span>
                {member.type && (
                  <span className={`font-mono text-[8px] px-1.5 py-0.5 uppercase ${typeBadgeColor(member.type)}`}>
                    {member.type.slice(0, 3)}
                  </span>
                )}
              </div>
            ))}
            {members.length > 6 && (
              <span className="font-mono text-[10px] text-dim">+{members.length - 6} more</span>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={() => router.push(`/volunteer/chat/${taskForce.id}`)}
            className="w-full mt-3"
          >
            💬 OPEN TEAM CHAT
          </Button>
        </div>
      )}

      <div className="p-4 border-b border-border-dim">
        <p className="font-display text-[13px] font-semibold text-ink uppercase tracking-wide mb-2">Mission log</p>
        <MissionTimeline
          assignmentId={assignment.id}
          endpoint={`/api/volunteer/assignment/${assignment.id}/updates`}
          refreshKey={timelineKey}
          emptyText="Your status changes and updates will appear here — Command sees them live."
        />
      </div>

      <div className="p-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => router.push('/volunteer/map')}>
          🗺 ROUTE
        </Button>
        <Button variant="secondary" onClick={() => router.push('/volunteer/inbox')}>
          📨 MESSAGE DMA
        </Button>
      </div>
    </div>
  );
}
