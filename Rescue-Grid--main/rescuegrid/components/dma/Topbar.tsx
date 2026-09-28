"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { AIAssistantButton } from "./AIAssistantButton";
import { useCounters } from "./CountersProvider";
import { useNow } from "@/hooks/useNow";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface TopbarProps {
  loginTime: Date;
  aiAssistantOpen?: boolean;
  onToggleAI?: () => void;
}

const NAV_TABS = [
  { label: "Dashboard", href: "/dma/dashboard" },
  { label: "Missions", href: "/dma/assignments" },
  { label: "Volunteers", href: "/dma/volunteers" },
  { label: "Task Forces", href: "/dma/deployments" },
  { label: "Resources", href: "/dma/resources" },
  { label: "Broadcast", href: "/dma/broadcast" },
  { label: "Messages", href: "/dma/messages" },
];

/**
 * Command top bar. It must never overflow, so items appear only when there's
 * room for them, and the ☰ menu (always visible) holds everything, logout
 * included:
 *   < 1280px   logo · critical count · menu (sections are in the menu)
 *   ≥ 1280px   + section tabs
 *   ≥ 1536px   + "Create task"
 *   ≥ 1800px   + AI assistant, active/volunteer counts, "Emergency broadcast"
 */
export default function Topbar({ loginTime, aiAssistantOpen, onToggleAI }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEscapeKey(() => setMenuOpen(false), menuOpen);
  const { counters, loading } = useCounters();
  const now = useNow(1000);
  const elapsed = now ? Math.max(0, Math.floor((now - loginTime.getTime()) / 1000)) : 0;
  const sessionElapsed = [Math.floor(elapsed / 3600), Math.floor((elapsed % 3600) / 60), elapsed % 60]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");

  const handleLogout = useCallback(async () => {
    if (!window.confirm("Log out of the command dashboard?")) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/dma/login");
    router.refresh();
  }, [router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  const counter = (label: string, value: number, valueClass: string, pulse = false) => (
    <span className="flex items-center gap-1.5 font-inter text-[11px] uppercase tracking-[0.1em] text-dim whitespace-nowrap">
      {label}
      {loading ? (
        <span className="inline-block w-4 h-4 bg-gray-100 animate-pulse rounded-sm" />
      ) : (
        <strong className={`text-[16px] ${valueClass} ${pulse ? "animate-critical-pulse" : ""}`}>{value}</strong>
      )}
    </span>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center h-[52px] px-4 bg-white border-b border-border-dim gap-3">
      <Link href="/dma/dashboard" className="flex items-center gap-2 shrink-0" aria-label="RescueGrid command dashboard">
        <span className="font-inter text-[18px] font-bold tracking-[0.08em] text-ink uppercase">RESCUE</span>
        <span className="font-inter text-[18px] font-bold tracking-[0.08em] text-orange uppercase">GRID</span>
      </Link>

      <nav className="hidden xl:flex items-center gap-0.5 min-w-0" aria-label="Command sections">
        {NAV_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive(tab.href) ? "page" : undefined}
            className={`px-2 2xl:px-3 py-1 font-inter text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors relative ${
              isActive(tab.href) ? "text-orange" : "text-dim hover:text-ink"
            }`}
          >
            {tab.label}
            {isActive(tab.href) && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange" />}
          </Link>
        ))}
      </nav>

      <div className="hidden min-[1800px]:block shrink-0">
        <AIAssistantButton isOpen={aiAssistantOpen || false} onClick={onToggleAI || (() => {})} />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 shrink-0">
        {counter("Critical", counters.critical, "text-alert", true)}
        <span className="hidden min-[1800px]:flex items-center gap-4">
          {counter("Active", counters.active, "text-orange")}
          {counter("Vols", counters.vols, "text-ink")}
        </span>
        <Button size="small" variant="primary" className="hidden 2xl:inline-flex whitespace-nowrap" onClick={() => go("/dma/dashboard?create=true")}>
          + CREATE TASK
        </Button>
        <Button size="small" variant="critical" className="hidden min-[1800px]:inline-flex whitespace-nowrap" onClick={() => go("/dma/broadcast")}>
          EMERGENCY BROADCAST
        </Button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="dma-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="w-10 h-10 flex items-center justify-center border border-border-dim text-ink hover:border-orange"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          id="dma-menu"
          className="absolute top-[52px] right-0 left-0 sm:left-auto sm:w-80 bg-white border border-border-dim shadow-lg max-h-[calc(100vh-52px)] overflow-y-auto"
        >
          <nav className="flex flex-col py-2 xl:hidden border-b border-border-dim" aria-label="Command sections">
            {NAV_TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(tab.href) ? "page" : undefined}
                className={`px-4 py-3 font-inter text-[13px] font-semibold uppercase tracking-[0.1em] ${
                  isActive(tab.href) ? "text-orange bg-orange/5 border-l-2 border-orange" : "text-ink"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 py-3 flex flex-wrap gap-4 border-b border-border-dim">
            {counter("Active", counters.active, "text-orange")}
            {counter("Vols", counters.vols, "text-ink")}
            <span className="font-inter text-[11px] uppercase tracking-[0.1em] text-dim whitespace-nowrap">
              Session <strong className="font-ibm-mono text-green-700">{sessionElapsed}</strong>
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            <Button size="small" variant="primary" onClick={() => go("/dma/dashboard?create=true")}>+ CREATE TASK</Button>
            <Button size="small" variant="critical" onClick={() => go("/dma/broadcast")}>BROADCAST</Button>
            <Button size="small" variant="ghost" onClick={() => { setMenuOpen(false); onToggleAI?.(); }}>AI ASSISTANT</Button>
            <Button size="small" variant="danger" onClick={handleLogout}>LOGOUT</Button>
          </div>
        </div>
      )}
    </header>
  );
}
