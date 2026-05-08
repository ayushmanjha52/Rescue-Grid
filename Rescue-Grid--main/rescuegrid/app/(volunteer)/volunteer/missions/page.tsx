'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useAssignments, Assignment } from '@/hooks/useAssignments';

export default function MissionsPage() {
  const router = useRouter();
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [historyAssignments, setHistoryAssignments] = useState<Assignment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const getVolunteerId = async () => {
      try {
        const res = await fetch('/api/volunteer/me');
        if (res.ok) {
          const data = await res.json();
          setVolunteerId(data.id);
        } else {
          router.push('/volunteer/login');
        }
      } catch {
        router.push('/volunteer/login');
      }
    };
    getVolunteerId();
  }, [router]);

  const { assignments: queueAssignments, loading } = useAssignments(
    volunteerId ? `assigned_to_volunteer=eq.${volunteerId}` : undefined
  );

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/volunteer/assignment/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryAssignments(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Refresh history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/volunteer/assignment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'en_route' }),
      });
      if (res.ok) {
        router.push('/volunteer/active');
      }
    } catch {}
    setActionLoading(null);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-alert';
      case 'urgent': return 'text-orange';
      default: return 'text-caution';
    }
  };

  const getUrgencyBg = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-alert/20';
      case 'urgent': return 'bg-orange/20';
      default: return 'bg-caution/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'COMPLETED';
      case 'failed': return 'FAILED';
      case 'active': return 'IN PROGRESS';
      default: return 'PENDING';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-ops bg-ops/20';
      case 'failed': return 'text-alert bg-alert/20';
      case 'active': return 'text-orange bg-orange/20';
      default: return 'text-dim bg-surface-3';
    }
  };

  const getTimerRemaining = (timer: string | null) => {
    if (!timer) return null;
    const end = new Date(timer).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const assignments = activeTab === 'queue' ? queueAssignments : historyAssignments;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-gray-400 text-xs">LOADING MISSIONS...</span>
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
          <span className="font-mono text-[10px] text-gray-400">DHANBAD DISPATCH</span>
        </div>

        <div className="flex p-4 gap-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-3 px-4 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all rounded-sm ${
              activeTab === 'queue'
                ? 'bg-orange text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Queue ({queueAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all rounded-sm ${
              activeTab === 'history'
                ? 'bg-orange text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            History ({historyAssignments.length})
          </button>
        </div>
      </div>

      <div className="p-4 pb-20">
        {assignments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <p className="font-display text-lg text-gray-900 mb-1">
              {activeTab === 'queue' ? 'No pending missions' : 'No completed missions'}
            </p>
            <p className="font-mono text-[11px] text-gray-400">
              {activeTab === 'queue' ? 'New assignments will appear here' : 'Your completed missions will be logged here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`bg-white overflow-hidden transition-all border border-gray-100 rounded-sm shadow-sm border-l-4 ${
                  assignment.status === 'completed' ? 'border-l-green-500' :
                  assignment.status === 'failed' ? 'border-l-red-500' :
                  assignment.status === 'active' ? 'border-l-orange' :
                  'border-l-amber-500'
                }`}
              >
                {/* Card Header - Always Visible */}
                <div
                  className="p-4"
                  onClick={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 font-mono text-[9px] uppercase font-semibold rounded-sm ${getStatusColor(assignment.status)}`}>
                        {getStatusLabel(assignment.status)}
                      </span>
                      <span className={`px-2 py-0.5 font-mono text-[9px] uppercase rounded-sm ${getUrgencyBg(assignment.urgency)} ${getUrgencyColor(assignment.urgency)}`}>
                        {assignment.urgency}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-gray-400">
                      {formatTime(assignment.created_at)}
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
                        <span className="truncate max-w-[120px]">{assignment.location_label.split(',')[0]}</span>
                      </span>
                    )}
                    {assignment.timer && (
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12,6 12,12 16,14"/>
                        </svg>
                        <span>{getTimerRemaining(assignment.timer)}</span>
                      </span>
                    )}
                  </div>

                  {/* Visual cue for interaction */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-gray-400">
                      {expandedId === assignment.id ? 'Tap to collapse' : 
                       assignment.status === 'active' ? 'Tap to view details' : 'Tap to accept'}
                    </span>
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      className={`text-gray-400 transition-transform ${expandedId === assignment.id ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6,9 12,15 18,9"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === assignment.id && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    <div className="p-4 space-y-4">
                      {/* Full task description */}
                      <div>
                        <p className="font-mono text-[9px] text-gray-400 uppercase tracking-wider mb-1">Mission Details</p>
                        <p className="text-gray-900 font-body text-[13px] leading-relaxed">{assignment.task}</p>
                      </div>

                      {/* Location details */}
                      {assignment.location_label && (
                        <div>
                          <p className="font-mono text-[9px] text-gray-400 uppercase tracking-wider mb-1">Location</p>
                          <p className="text-gray-900 font-body text-[13px]">{assignment.location_label}</p>
                          {assignment.latitude && assignment.longitude && (
                            <p className="font-mono text-[10px] text-gray-400 mt-1">
                              {assignment.latitude.toFixed(5)}, {assignment.longitude.toFixed(5)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {activeTab === 'queue' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="primary"
                            onClick={() => handleStart(assignment.id)}
                            disabled={actionLoading === assignment.id}
                            className="flex-1"
                          >
                            {actionLoading === assignment.id ? 'STARTING...' : 
                             assignment.status === 'active' ? 'START MISSION →' : 'CONTINUE MISSION →'}
                          </Button>
                        </div>
                      )}

                      {activeTab === 'queue' && assignment.status === 'active' && (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => router.push('/volunteer/map')}
                          >
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
                      )}

                      {activeTab === 'history' && (
                        <div className="pt-2">
                          <p className="font-mono text-[10px] text-gray-400">
                            {assignment.status === 'completed' ? 'Completed' : 'Failed'} on{' '}
                            {new Date(assignment.updated_at || assignment.created_at).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
