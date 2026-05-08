'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

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
}

interface TFMember {
  id: string;
  name: string;
  type: string;
  status: string;
  role: string | null;
}

export default function ActiveMissionPage() {
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [tfMembers, setTfMembers] = useState<TFMember[]>([]);
  const [tfName, setTfName] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Directly fetch the active assignment
  const fetchActiveAssignment = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/volunteer/assignment/active');
      if (res.ok) {
        const data = await res.json();
        setAssignment(data);
      }
    } catch (err) {
      console.error('Error fetching active assignment:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveAssignment();
  }, [fetchActiveAssignment]);

  // Poll for updates every 5 seconds to ensure sync
  useEffect(() => {
    const interval = setInterval(fetchActiveAssignment, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveAssignment]);

  useEffect(() => {
    const fetchTfDetails = async () => {
      if (assignment?.assigned_to_taskforce) {
        try {
          const [membersRes, tfRes] = await Promise.all([
            fetch(`/api/dma/taskforce/${assignment.assigned_to_taskforce}/members`),
            fetch(`/api/dma/taskforce/${assignment.assigned_to_taskforce}`),
          ]);
          
          if (membersRes.ok) {
            const members = await membersRes.json();
            setTfMembers(members);
          }
          if (tfRes.ok) {
            const tf = await tfRes.json();
            setTfName(tf?.name || 'Task Force');
          }
        } catch {}
      }
    };
    fetchTfDetails();
  }, [assignment?.assigned_to_taskforce]);

  const updateStatus = async (newStatus: string) => {
    if (!assignment) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/volunteer/assignment/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === 'completed' || newStatus === 'failed') {
          router.push('/volunteer/missions');
        } else {
          // Refresh to ensure UI stays in sync
          await fetchActiveAssignment();
        }
      }
    } catch {}
    setUpdating(false);
  };

  const getTimerRemaining = () => {
    if (!assignment?.timer) return null;
    const end = new Date(assignment.timer).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return '00:00:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-orange text-void';
      case 'on_my_way':
      case 'en_route': return 'bg-orange/80 text-void';
      case 'arrived': return 'bg-ops text-void';
      default: return 'bg-surface-3 text-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'ASSIGNED';
      case 'on_my_way':
      case 'en_route': return 'EN ROUTE';
      case 'arrived': return 'ON SITE';
      default: return status.toUpperCase();
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-alert';
      case 'urgent': return 'text-orange';
      default: return 'text-caution';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'police': return 'bg-blue-accent/20 text-blue-accent';
      case 'ndrf': return 'bg-ops/20 text-ops';
      case 'ngo': return 'bg-purple/20 text-purple';
      default: return 'bg-surface-3 text-dim';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  return (
    <div className="min-h-screen bg-void">
      {/* Mission Header */}
      <div className="bg-surface-1 border-b border-border-dim p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-orange">
              MISSION-{assignment.id.slice(0, 8).toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 font-mono text-[9px] font-semibold ${getStatusColor(assignment.status)}`}>
              {getStatusLabel(assignment.status)}
            </span>
          </div>
          <span className={`font-mono text-[10px] uppercase ${getUrgencyColor(assignment.urgency)}`}>
            {assignment.urgency}
          </span>
        </div>
        
        <h1 className="font-display text-xl font-semibold text-ink leading-tight mb-4">
          {assignment.task}
        </h1>

        {/* Location Card */}
        <div className="bg-surface-2 p-3 mb-4" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
          <div className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange mt-0.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <div className="flex-1">
              <p className="text-ink font-body text-[13px]">
                {assignment.location_label || 'Location not specified'}
              </p>
              {assignment.latitude && assignment.longitude && (
                <p className="font-mono text-[10px] text-dim mt-1">
                  {assignment.latitude.toFixed(6)}, {assignment.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
          {assignment.timer && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-dim">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-caution">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <span className="font-mono text-[12px] text-caution">{getTimerRemaining()}</span>
              <span className="font-mono text-[10px] text-dim">remaining</span>
            </div>
          )}
        </div>

        {/* Status Actions */}
        <div className="flex gap-2">
          {assignment.status === 'active' && (
            <Button
              variant="secondary"
              onClick={() => updateStatus('en_route')}
              disabled={updating}
              className="flex-1"
            >
              ACCEPT MISSION
            </Button>
          )}
          {assignment.status === 'en_route' && (
            <Button
              variant="secondary"
              onClick={() => updateStatus('arrived')}
              disabled={updating}
              className="flex-1"
            >
              ARRIVED AT SITE
            </Button>
          )}
        </div>
        
        {assignment.status !== 'completed' && assignment.status !== 'failed' && (
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
        )}
      </div>

      {/* Task Force Section */}
      {tfMembers.length > 0 && (
        <div className="p-4 border-b border-border-dim">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span className="font-display text-[13px] font-semibold text-ink uppercase tracking-wide">
                {tfName}
              </span>
              <span className="font-mono text-[10px] text-dim">({tfMembers.length} members)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {tfMembers.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-2 bg-surface-2 px-2 py-1.5" 
                   style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  member.status === 'active' ? 'bg-ops/20 text-ops' : 'bg-surface-3 text-dim'
                }`}>
                  {getInitials(member.name)}
                </div>
                <span className="font-body text-[11px] text-ink">{member.name.split(' ')[0]}</span>
                <span className={`font-mono text-[8px] px-1.5 py-0.5 uppercase ${getTypeBadgeColor(member.type)}`}>
                  {member.type?.slice(0, 3)}
                </span>
              </div>
            ))}
            {tfMembers.length > 5 && (
              <span className="font-mono text-[10px] text-dim">+{tfMembers.length - 5} more</span>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={() => router.push(`/volunteer/chat/${assignment.assigned_to_taskforce}`)}
            className="w-full mt-3"
          >
            <div className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              OPEN TEAM CHAT
            </div>
          </Button>
        </div>
      )}

      {/* Map Action */}
      <div className="p-4">
        <Button
          variant="secondary"
          onClick={() => router.push('/volunteer/map')}
          className="w-full"
        >
          <div className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            VIEW ROUTE ON MAP
          </div>
        </Button>
      </div>
    </div>
  );
}
