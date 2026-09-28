'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useAssignments, Assignment } from '@/hooks/useAssignments';
import { formatRelative, useNow } from '@/hooks/useNow';
import { assignmentStatusLabel, normalizeAssignmentStatus } from '@/lib/status';

function urgencyClasses(urgency: string) {
  switch (urgency) {
    case 'critical': return 'text-alert bg-alert/20';
    case 'urgent': return 'text-orange bg-orange/20';
    default: return 'text-caution bg-caution/20';
  }
}

function statusClasses(status: string) {
  switch (normalizeAssignmentStatus(status)) {
    case 'completed': return 'text-ops bg-ops/20';
    case 'failed': return 'text-alert bg-alert/20';
    case 'en_route':
    case 'arrived': return 'text-orange bg-orange/20';
    case 'active': return 'text-intel bg-intel/20';
    default: return 'text-dim bg-surface-3';
  }
}

function borderClass(status: string) {
  switch (normalizeAssignmentStatus(status)) {
    case 'completed': return 'border-l-green-500';
    case 'failed': return 'border-l-red-500';
    case 'en_route':
    case 'arrived': return 'border-l-orange';
    default: return 'border-l-amber-500';
  }
}

function timeLeft(timer: string | null, now: number) {
  if (!timer || !now) return null;
  const diff = new Date(timer).getTime() - now;
  if (diff <= 0) return 'Overdue';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function MissionsPage() {
  const router = useRouter();
  const now = useNow(30000);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [historyAssignments, setHistoryAssignments] = useState<Assignment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { assignments: queueAssignments, loading } = useAssignments('volunteer');

  // Load history for the tab counter, and refresh it whenever the tab changes.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/volunteer/assignment/history', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setHistoryAssignments(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleStart = async (assignment: Assignment) => {
    // Only a freshly assigned mission needs to be started; otherwise just resume it.
    if (normalizeAssignmentStatus(assignment.status) !== 'active') {
      router.push('/volunteer/active');
      return;
    }

    setActionLoading(assignment.id);
    setActionError('');
    try {
      const res = await fetch(`/api/volunteer/assignment/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'en_route' }),
      });
      if (res.ok) {
        router.push('/volunteer/active');
        return;
      }
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || 'Could not start this mission');
    } catch {
      setActionError('Network error — please try again');
    }
    setActionLoading(null);
  };

  const assignments = activeTab === 'queue' ? queueAssignments : historyAssignments;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-gray-500 text-xs">LOADING MISSIONS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between p-4 pb-0">
          <h1 className="font-display text-xl font-bold text-gray-900 uppercase tracking-wide">
            My Missions
          </h1>
          <span className="font-mono text-[10px] text-gray-500">DISPATCH</span>
        </div>

        <div className="flex p-4 gap-2" role="tablist">
          {(['queue', 'history'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all rounded-sm ${
                activeTab === tab ? 'bg-orange text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab === 'queue' ? `Queue (${queueAssignments.length})` : `History (${historyAssignments.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-20">
        {actionError && (
          <p className="mb-3 font-mono text-[11px] text-alert" role="alert">{actionError}</p>
        )}

        {assignments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <p className="font-display text-lg text-gray-900 mb-1">
              {activeTab === 'queue' ? 'No pending missions' : 'No completed missions'}
            </p>
            <p className="font-mono text-[11px] text-gray-500">
              {activeTab === 'queue' ? 'New assignments will appear here' : 'Your completed missions will be logged here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const status = normalizeAssignmentStatus(assignment.status);
              const isExpanded = expandedId === assignment.id;
              const remaining = activeTab === 'queue' ? timeLeft(assignment.timer, now) : null;

              return (
                <div
                  key={assignment.id}
                  className={`bg-white overflow-hidden transition-all border border-gray-100 rounded-sm shadow-sm border-l-4 ${borderClass(assignment.status)}`}
                >
                  <button
                    type="button"
                    className="w-full text-left p-4"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 font-mono text-[9px] uppercase font-semibold rounded-sm ${statusClasses(assignment.status)}`}>
                          {assignmentStatusLabel(assignment.status)}
                        </span>
                        <span className={`px-2 py-0.5 font-mono text-[9px] uppercase rounded-sm ${urgencyClasses(assignment.urgency)}`}>
                          {assignment.urgency}
                        </span>
                        {assignment.task_force?.name && (
                          <span className="px-2 py-0.5 font-mono text-[9px] uppercase rounded-sm bg-ops/10 text-ops">
                            👥 {assignment.task_force.name}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-gray-500 shrink-0">
                        {formatRelative(activeTab === 'history' ? assignment.updated_at : assignment.created_at, now)}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-semibold text-gray-900 leading-snug mb-2">
                      {assignment.task}
                    </h3>

                    <div className="flex items-center gap-4 text-[11px] text-gray-500">
                      {assignment.location_label && (
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          <span className="truncate max-w-[140px]">{assignment.location_label.split(',')[0]}</span>
                        </span>
                      )}
                      {remaining && (
                        <span className={`flex items-center gap-1 ${remaining === 'Overdue' ? 'text-alert' : ''}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12,6 12,12 16,14"/>
                          </svg>
                          <span>{remaining}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-gray-500">
                        {isExpanded ? 'Tap to collapse' : 'Tap for details'}
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      <div className="p-4 space-y-4">
                        <div>
                          <p className="font-mono text-[9px] text-gray-500 uppercase tracking-wider mb-1">Mission Details</p>
                          <p className="text-gray-900 font-body text-[13px] leading-relaxed whitespace-pre-wrap">{assignment.task}</p>
                        </div>

                        {assignment.location_label && (
                          <div>
                            <p className="font-mono text-[9px] text-gray-500 uppercase tracking-wider mb-1">Location</p>
                            <p className="text-gray-900 font-body text-[13px]">{assignment.location_label}</p>
                            {assignment.latitude != null && assignment.longitude != null && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${assignment.latitude},${assignment.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] text-orange underline mt-1 inline-block"
                              >
                                {assignment.latitude.toFixed(5)}, {assignment.longitude.toFixed(5)} · Navigate ↗
                              </a>
                            )}
                          </div>
                        )}

                        {activeTab === 'queue' && (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => handleStart(assignment)}
                              disabled={actionLoading === assignment.id}
                              className="w-full"
                            >
                              {actionLoading === assignment.id
                                ? 'STARTING...'
                                : status === 'active'
                                  ? 'ACCEPT & START →'
                                  : 'CONTINUE MISSION →'}
                            </Button>

                            <div className="flex gap-2">
                              <Button variant="secondary" size="small" onClick={() => router.push('/volunteer/map')}>
                                🗺 Map
                              </Button>
                              {assignment.assigned_to_taskforce && (
                                <Button
                                  variant="secondary"
                                  size="small"
                                  onClick={() => router.push(`/volunteer/chat/${assignment.assigned_to_taskforce}`)}
                                >
                                  💬 Team Chat
                                </Button>
                              )}
                            </div>
                          </>
                        )}

                        {activeTab === 'history' && (
                          <p className="font-mono text-[10px] text-gray-500">
                            {status === 'completed' ? 'Completed' : 'Failed'} on{' '}
                            {new Date(assignment.updated_at || assignment.created_at).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
