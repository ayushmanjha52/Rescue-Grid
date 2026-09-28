"use client";

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChatScrollArea, { useChatScroll } from "@/components/ChatScrollArea";
import StatusTimeline from "@/components/victim/StatusTimeline";
import StatusBadge from "@/components/ui/StatusBadge";
import { HELPLINE_NUMBER } from "@/lib/config";
import HelplineLink from "@/components/victim/HelplineLink";
import { REPORT_UPDATED_EVENT, reportTopic } from "@/lib/realtimeTopics";
import { rememberReport } from "@/lib/myReportsStorage";
import { reportReference } from "@/lib/status";

type Report = {
  id: string;
  city: string | null;
  district: string | null;
  situation: string;
  custom_message: string | null;
  urgency: string;
  status: string;
  created_at: string;
};

type Message = {
  id: string;
  content: string;
  sender_type: string;
  victim_report_id: string;
  created_at: string;
  read_at: string | null;
};

const SITUATION_COLORS: Record<string, string> = {
  food: "#1E8449",
  water: "#1F5FCC",
  medical: "#B45309",
  rescue: "#D32F2F",
  shelter: "#7E22CE",
  missing: "#4B5563",
};

const MAX_MESSAGES = 200;

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatReportId(id: string, createdAt: string) {
  return `REPORT #${reportReference(id, createdAt)}`;
}

function appendMessage(prev: Message[], message: Message) {
  if (prev.some((m) => m.id === message.id)) return prev;
  const updated = [...prev, message];
  return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
}

export default function ReportStatusPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  const scroll = useChatScroll();
  const { notifyNewMessage, scrollToBottom } = scroll;

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [reportRes, messagesRes] = await Promise.all([
          fetch(`/api/victim/report/${reportId}`),
          fetch(`/api/victim/report/${reportId}/messages`),
        ]);
        const reportData = await reportRes.json();
        const messagesData = await messagesRes.json().catch(() => ({}));
        if (cancelled) return;

        if (!reportRes.ok) {
          setError(reportData.error || "Report not found");
        } else {
          rememberReport(reportId);
          setReport(reportData.report);
          setMessages(Array.isArray(messagesData.messages) ? messagesData.messages : []);
        }
      } catch {
        if (!cancelled) setError("Failed to load report. Check your connection.");
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const messagesRef = useRef<Message[]>([]);
  useLayoutEffect(() => {
    messagesRef.current = messages;
  });

  // Live updates. Victims can't read the database tables (privacy), so the
  // server pings this report's broadcast topic whenever command replies or the
  // status changes, and the page refetches through the API. A slow poll and a
  // refresh on returning to the tab cover missed pings / flaky networks.
  useEffect(() => {
    const refresh = () => {
      fetch(`/api/victim/report/${reportId}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.report) setReport((prev) => (prev ? { ...prev, ...data.report } : data.report));
        })
        .catch(() => {});
      fetch(`/api/victim/report/${reportId}/messages`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!Array.isArray(data?.messages)) return;
          const fresh = (data.messages as Message[]).filter(
            (m) => !messagesRef.current.some((known) => known.id === m.id)
          );
          if (fresh.length === 0) return;
          setMessages((prev) => fresh.reduce(appendMessage, prev));
          notifyNewMessage();
        })
        .catch(() => {});
    };

    const supabase = createClient();
    const channel = supabase
      .channel(reportTopic(reportId))
      .on("broadcast", { event: REPORT_UPDATED_EVENT }, refresh)
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = setInterval(onVisible, 30000);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [reportId, notifyNewMessage]);

  const handleSendMessage = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || !report || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/victim/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, victim_report_id: reportId }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const saved = (await res.json()) as Message;
      setMessages((prev) => appendMessage(prev, saved));
      setNewMessage("");
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch {
      setSendError("Message not sent. Check your connection or call the helpline.");
    } finally {
      setSending(false);
    }
  }, [newMessage, report, sending, reportId, scrollToBottom]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center" style={{ height: '100dvh' }}>
        <p className="font-mono text-[11px] text-dim uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="text-center">
          <p className="font-mono text-[11px] text-alert uppercase tracking-widest mb-4">
            {error || "Report not found"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="font-mono text-[10px] text-muted uppercase tracking-wider hover:text-orange"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const borderColor = SITUATION_COLORS[report.situation] || "#C44A12";

  const header = (
    <div
      className="px-4 py-3 border-b border-border-dim bg-surface-1"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/report/my")}
            className="text-muted hover:text-orange transition-colors"
            aria-label="My reports"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-mono text-[10px] text-orange uppercase tracking-wider">
            {formatReportId(report.id, report.created_at)}
          </span>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase px-1.5 py-0.5"
          style={{ backgroundColor: `${borderColor}22`, color: borderColor }}
        >
          {report.situation}
        </span>
        <span
          className={`font-mono text-[10px] uppercase px-1.5 py-0.5 ${
            report.urgency === "critical"
              ? "bg-alert/20 text-alert"
              : report.urgency === "urgent"
              ? "bg-orange/20 text-orange"
              : "bg-intel/20 text-intel"
          }`}
        >
          {report.urgency}
        </span>
      </div>
      <div className="mt-2">
        <p className="font-body text-[13px] text-muted">
          📍 {[report.city, report.district].filter(Boolean).join(", ") || "Location received"}
        </p>
        <p className="font-mono text-[10px] text-dim mt-0.5">
          Reported: {formatTime(report.created_at)} IST
        </p>
        {report.custom_message && (
          <div className="mt-2 p-2 bg-surface-2 border-l-2 border-orange">
            <p className="font-mono text-[9px] text-dim uppercase tracking-wider mb-0.5">Your report / आपकी रिपोर्ट</p>
            <p className="font-body text-[13px] text-ink whitespace-pre-wrap break-words">{report.custom_message}</p>
          </div>
        )}
      </div>
    </div>
  );

  const inputArea = (
    <div className="px-4 py-3 border-t border-border-dim bg-surface-1">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSendMessage();
        }}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message to command..."
          maxLength={2000}
          aria-label="Message"
          className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="font-display font-semibold text-[11px] uppercase tracking-[0.1em] text-white bg-orange px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)" }}
        >
          {sending ? "..." : "SEND →"}
        </button>
      </form>
      {sendError && <p className="mt-1 font-mono text-[10px] text-alert" role="alert">{sendError}</p>}
    </div>
  );

  const footerArea = (
    <div className="px-4 py-3 border-t border-border-dim bg-surface-1" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <HelplineLink
        className="block w-full text-center font-[family-name:var(--font-ibm-mono)] font-medium text-[13px] uppercase tracking-[0.15em] text-white bg-orange py-3 transition-opacity hover:opacity-90"
        style={{
          clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
        }}
      >
        📞 Call Helpline: {HELPLINE_NUMBER}
      </HelplineLink>
    </div>
  );

  return (
    <ChatScrollArea
      header={header}
      inputArea={inputArea}
      footerArea={footerArea}
      scroll={scroll}
      showJumpToBottom
      className="min-h-screen"
    >
      <StatusTimeline status={report.status} createdAt={report.created_at} />
      <div className="space-y-3 px-4 py-4">
        <p className="font-mono text-[10px] text-dim uppercase tracking-[0.15em] text-center mb-4">
          — Updates from Command —
        </p>
        {messages.length === 0 ? (
          <p className="font-mono text-[11px] text-dim text-center py-8">
            No messages yet. DMA will respond soon.
          </p>
        ) : (
          messages.map((msg) => {
            const isDma = msg.sender_type === "dma";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isDma ? "items-start" : "items-end"}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="font-mono text-[10px] text-dim uppercase">
                    {isDma ? "DMA · COMMAND" : "You"}
                  </span>
                  <span className="font-mono text-[10px] text-dim">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <div
                  className={`max-w-[80%] px-3 py-2 text-sm font-body whitespace-pre-wrap break-words ${
                    isDma
                      ? "bg-orange-dim text-ink border-l-2 border-orange"
                      : "bg-surface-3 text-ink"
                  }`}
                  style={{
                    clipPath: isDma
                      ? "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)"
                      : "polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ChatScrollArea>
  );
}
