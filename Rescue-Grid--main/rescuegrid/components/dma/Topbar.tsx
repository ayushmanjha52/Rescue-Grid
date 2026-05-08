"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { AIAssistantButton } from "./AIAssistantButton";
import { useCounters } from "./CountersProvider";

interface TopbarProps {
  loginTime: Date;
  aiAssistantOpen?: boolean;
  onToggleAI?: () => void;
}

const NAV_TABS = [
  { label: "Dashboard", href: "/dma/dashboard" },
  { label: "Task Forces", href: "/dma/deployments" },
  { label: "Resources", href: "/dma/resources" },
  { label: "Broadcast", href: "/dma/broadcast" },
  { label: "Messages", href: "/dma/messages" },
];

export default function Topbar({ loginTime, aiAssistantOpen, onToggleAI }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { counters, loading } = useCounters();
  const [sessionElapsed, setSessionElapsed] = useState("00:00:00");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - loginTime.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setSessionElapsed(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [loginTime]);

  const handleLogout = useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dma/login");
  }, [router]);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center h-[52px] px-4 bg-white border-b border-border-dim gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-inter text-[18px] font-bold tracking-[0.08em] text-ink uppercase">
          RESCUE
        </span>
        <span className="font-inter text-[18px] font-bold tracking-[0.08em] text-orange uppercase">
          GRID
        </span>
      </div>

      <nav className="flex items-center gap-1">
        {NAV_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              px-3 py-1 font-inter text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors relative
              ${isActive(tab.href) ? "text-orange" : "text-dim hover:text-ink"}
            `}
          >
            {tab.label}
            {isActive(tab.href) && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange" />
            )}
          </Link>
        ))}
      </nav>

      <div className="h-4 w-px bg-border-dim mx-1" />

      <AIAssistantButton 
        isOpen={aiAssistantOpen || false}
        onClick={onToggleAI || (() => {})}
      />

      <div className="flex-1" />

      <div className="flex items-center gap-5 shrink-0">
        <div className="flex items-center gap-2 font-inter text-[11px] uppercase tracking-[0.1em]">
          <span className="text-dim">CRITICAL</span>
          {loading ? (
            <div className="w-4 h-4 bg-red-100 animate-pulse rounded-sm" />
          ) : (
            <span className="text-[16px] font-bold text-alert animate-critical-pulse">{counters.critical}</span>
          )}
        </div>
        <div className="flex items-center gap-2 font-inter text-[11px] uppercase tracking-[0.1em]">
          <span className="text-dim">ACTIVE</span>
          {loading ? (
            <div className="w-4 h-4 bg-orange/20 animate-pulse rounded-sm" />
          ) : (
            <span className="text-[16px] font-bold text-orange">{counters.active}</span>
          )}
        </div>
        <div className="flex items-center gap-2 font-inter text-[11px] uppercase tracking-[0.1em]">
          <span className="text-dim">VOLS</span>
          {loading ? (
            <div className="w-4 h-4 bg-gray-100 animate-pulse rounded-sm" />
          ) : (
            <span className="text-[16px] font-bold text-ink">{counters.vols}</span>
          )}
        </div>

        <div className="h-4 w-px bg-border-dim mx-1" />

        <div className="flex items-center gap-1 px-2 py-1 rounded-sm bg-green-50 border border-green-100">
          <span className="font-ibm-mono text-[13px] text-green-600 tracking-wider">{sessionElapsed}</span>
        </div>

        <div className="h-4 w-px bg-border-dim mx-1" />

        <Button
          size="small"
          variant="primary"
          onClick={() => router.push("/dma/dashboard?create=true")}
        >
          + CREATE TASK
        </Button>

        <Button
          size="small"
          variant="critical"
          onClick={() => router.push("/dma/broadcast")}
        >
          EMERGENCY BROADCAST
        </Button>

        <button
          onClick={handleLogout}
          className="font-inter text-[10px] text-dim uppercase tracking-[0.1em] hover:text-alert transition-colors ml-2"
        >
          LOGOUT
        </button>
      </div>
    </header>
  );
}
