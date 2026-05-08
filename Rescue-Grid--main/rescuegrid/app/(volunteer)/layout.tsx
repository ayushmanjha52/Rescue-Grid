'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { LocationProvider } from '@/components/volunteer/LocationProvider';

interface ActiveAssignment {
  id: string;
  task: string;
  location_label: string;
  urgency: string;
  status: string;
  timer: string | null;
}

interface PendingCount {
  queue: number;
}

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null);
  const [pendingCount, setPendingCount] = useState<PendingCount>({ queue: 0 });
  const [resourceCount, setResourceCount] = useState(0);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const getVolunteerId = async () => {
      const cookie = document.cookie.split(';').find(c => c.trim().startsWith('volunteer_session='));
      if (cookie) {
        try {
          const session = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
          setVolunteerId(session.volunteer_id);
        } catch {}
      }
    };
    getVolunteerId();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [assignRes, queueRes, resourcesRes] = await Promise.all([
        fetch('/api/volunteer/assignment/active'),
        fetch('/api/volunteer/assignment/queue'),
        fetch('/api/volunteer/resources'),
      ]);

      if (assignRes.ok) {
        const data = await assignRes.json();
        setActiveAssignment(data);
      }

      if (queueRes.ok) {
        const data = await queueRes.json();
        setPendingCount({ queue: Array.isArray(data) ? data.length : 0 });
      }

      if (resourcesRes.ok) {
        const data = await resourcesRes.json();
        const count = (data.mine?.length || 0) + (data.taskForce?.length || 0);
        setResourceCount(count);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (volunteerId) {
      fetchData();
    }
  }, [fetchData, volunteerId]);

  useEffect(() => {
    if (!volunteerId) return;

    channelRef.current = supabase
      .channel(`volunteer-layout-${volunteerId}`)
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'assignment',
          filter: `assigned_to_volunteer=eq.${volunteerId}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'resource_allocation',
          filter: `volunteer_id=eq.${volunteerId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [volunteerId, supabase, fetchData]);

  const getTimerRemaining = (timer: string | null) => {
    if (!timer) return null;
    const end = new Date(timer).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return '00:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
      badge: pendingCount.queue > 0 ? pendingCount.queue : null
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
      badgeType: 'live' as const
    },
    {
      href: '/volunteer/inbox',
      label: 'Inbox',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
      badge: null
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
      badge: null
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
      badge: resourceCount > 0 ? resourceCount : null
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
      badge: null
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  const hideNav = pathname === '/volunteer/login' || pathname === '/volunteer/login/verify';
  const isAuthPage = pathname === '/volunteer/login' || pathname === '/volunteer/login/verify';

  const content = (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
      <div className="h-10 bg-[#FAFBFC] border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between px-4">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#5A6270] tracking-wider">{currentTime}</span>
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-display)] text-[13px] font-semibold tracking-[0.15em]">
            <span className="text-[#1A1D21]">RESCUE</span>
            <span className="text-[#FF6B2B]">GRID</span>
          </span>
        </div>
        <div className="w-12" />
      </div>

      {activeAssignment && (
        <Link
          href="/volunteer/active"
          className="bg-[#FF6B2B] text-white flex items-center justify-between px-4 h-11 hover:bg-[#FF6B2B]/90 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-[family-name:var(--font-display)] text-[13px] font-semibold uppercase tracking-wide truncate max-w-[180px]">
              {activeAssignment.task}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {activeAssignment.timer && (
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-white/80">
                {getTimerRemaining(activeAssignment.timer)}
              </span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </div>
        </Link>
      )}

      <main className={`flex-1 overflow-y-auto ${hideNav ? '' : 'pb-20'}`}>{children}</main>

      {!hideNav && (
      <nav className="fixed bottom-0 left-0 right-0 h-[68px] bg-white border-t border-[rgba(0,0,0,0.08)] flex items-stretch shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all relative ${
                active ? 'text-[#FF6B2B]' : 'text-[#5A6270]'
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[#FF6B2B] rounded-full" />
              )}
              
              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className={`absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-[family-name:var(--font-mono)] font-bold rounded-full ${
                    tab.badgeType === 'live' 
                      ? 'text-[#2ECC71] animate-pulse' 
                      : 'bg-[#FF6B2B] text-white'
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
      )}
    </div>
  );

  // Don't wrap auth pages with LocationProvider
  if (isAuthPage) {
    return content;
  }

  return (
    <LocationProvider>
      {content}
    </LocationProvider>
  );
}
