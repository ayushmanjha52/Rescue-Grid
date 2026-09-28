'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LocationProvider } from '@/components/volunteer/LocationProvider';
import { VolunteerSessionProvider, useVolunteerSession } from '@/components/volunteer/VolunteerSessionProvider';
import { formatCountdown, useNow } from '@/hooks/useNow';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface ActiveAssignment {
  id: string;
  task: string;
  location_label: string;
  urgency: string;
  status: string;
  timer: string | null;
}

interface TaskForceSummary {
  id: string;
}

const AUTH_PAGES = ['/volunteer/login'];

function VolunteerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { volunteer } = useVolunteerSession();
  const volunteerId = volunteer?.id ?? null;
  const now = useNow(1000);
  const isOnline = useOnlineStatus();

  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [resourceCount, setResourceCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [taskForceIds, setTaskForceIds] = useState<string[]>([]);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [assignRes, queueRes, resourcesRes, messagesRes, tfRes] = await Promise.all([
        fetch('/api/volunteer/assignment/active'),
        fetch('/api/volunteer/assignment/queue'),
        fetch('/api/volunteer/resources'),
        fetch('/api/volunteer/message/direct'),
        fetch('/api/volunteer/taskforces'),
      ]);

      if (assignRes.ok) setActiveAssignment(await assignRes.json());
      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueueCount(Array.isArray(data) ? data.length : 0);
      }
      if (resourcesRes.ok) {
        const data = await resourcesRes.json();
        setResourceCount((data.mine?.length || 0) + (data.taskForce?.length || 0));
      }
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setUnreadCount(
          Array.isArray(data) ? data.filter((m: { sender_type: string; read_at: string | null }) => m.sender_type === 'dma' && !m.read_at).length : 0
        );
      }
      if (tfRes.ok) {
        const data = await tfRes.json();
        const ids = Array.isArray(data) ? data.map((tf: TaskForceSummary) => tf.id).sort() : [];
        setTaskForceIds((prev) => (prev.join() === ids.join() ? prev : ids));
      }
    } catch {
      // Offline — badges keep their last values.
    }
  }, []);

  const scheduleRefetch = useCallback((delay = 400) => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => void fetchData(), delay);
  }, [fetchData]);

  // Refresh badges on login and on every navigation.
  useEffect(() => {
    if (volunteerId) scheduleRefetch(0);
  }, [scheduleRefetch, volunteerId, pathname]);

  // Live updates for this volunteer's missions, task forces, resources and inbox.
  useEffect(() => {
    if (!volunteerId) return;
    const supabase = createClient();
    const onChange = () => scheduleRefetch();

    let channel = supabase
      .channel(`volunteer-shell-${volunteerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment', filter: `assigned_to_volunteer=eq.${volunteerId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_allocation', filter: `volunteer_id=eq.${volunteerId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message', filter: `receiver_id=eq.${volunteerId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_force_member', filter: `volunteer_id=eq.${volunteerId}` }, onChange);

    if (taskForceIds.length > 0) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment', filter: `assigned_to_taskforce=in.(${taskForceIds.join(',')})` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_allocation', filter: `task_force_id=in.(${taskForceIds.join(',')})` }, onChange);
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [volunteerId, taskForceIds, scheduleRefetch]);

  useEffect(() => () => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
  }, []);

  const clock = now
    ? new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  const tabs = [
    {
      href: '/volunteer/missions',
      label: 'Tasks',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
      ),
      badge: queueCount > 0 ? queueCount : null,
    },
    {
      href: '/volunteer/active',
      label: 'Active',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
      ),
      badge: activeAssignment ? '●' : null,
      badgeType: 'live' as const,
    },
    {
      href: '/volunteer/inbox',
      label: 'Inbox',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      href: '/volunteer/map',
      label: 'Map',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/>
          <line x1="8" y1="2" x2="8" y2="18"/>
          <line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
      ),
      badge: null,
    },
    {
      href: '/volunteer/resources',
      label: 'Resources',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      ),
      badge: resourceCount > 0 ? resourceCount : null,
    },
    {
      href: '/volunteer/profile',
      label: 'Profile',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      badge: null,
    },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // These pages size themselves to the viewport and handle the bottom nav themselves.
  const fullBleed = pathname === '/volunteer/map' || pathname === '/volunteer/inbox';
  const countdown = formatCountdown(activeAssignment?.timer, now);

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
      <div className="h-10 bg-[#FAFBFC] border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between px-4">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#5A6270] tracking-wider w-16">{clock}</span>
        <Link
          href="/volunteer/missions"
          className="font-[family-name:var(--font-display)] text-[13px] font-semibold tracking-[0.15em]"
          aria-label="RescueGrid missions"
        >
          <span className="text-[#1A1D21]">RESCUE</span>
          <span className="text-[#C44A12]">GRID</span>
        </Link>
        <span className={`w-16 text-right font-mono text-[9px] uppercase tracking-wider ${isOnline ? 'text-[#1E8449]' : 'text-[#D32F2F]'}`}>
          {isOnline ? '● Online' : '● Offline'}
        </span>
      </div>

      {activeAssignment && pathname !== '/volunteer/active' && (
        <Link
          href="/volunteer/active"
          className="bg-[#C44A12] text-white flex items-center justify-between px-4 h-11 hover:bg-[#C44A12]/90 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shrink-0" />
            <span className="font-[family-name:var(--font-display)] text-[13px] font-semibold uppercase tracking-wide truncate">
              {activeAssignment.task}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {countdown && (
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-white/80">
                {countdown}
              </span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </div>
        </Link>
      )}

      <main className={`flex-1 overflow-y-auto ${fullBleed ? '' : 'pb-20'}`}>{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 h-[68px] bg-white border-t border-[rgba(0,0,0,0.08)] flex items-stretch shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all relative ${
                active ? 'text-[#C44A12]' : 'text-[#5A6270]'
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[#C44A12] rounded-full" />
              )}

              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className={`absolute -top-1 -right-2 min-w-[16px] h-4 px-0.5 flex items-center justify-center text-[9px] font-[family-name:var(--font-mono)] font-bold rounded-full ${
                    tab.badgeType === 'live'
                      ? 'text-[#1E8449] animate-pulse'
                      : 'bg-[#C44A12] text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login pages render bare: no session, GPS tracking or navigation yet.
  if (AUTH_PAGES.includes(pathname)) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <VolunteerSessionProvider>
      <LocationProvider>
        <VolunteerShell>{children}</VolunteerShell>
      </LocationProvider>
    </VolunteerSessionProvider>
  );
}
