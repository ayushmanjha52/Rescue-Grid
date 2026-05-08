"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import ChatScrollArea, { useChatScroll } from "@/components/ChatScrollArea";
import StatusTimeline from "@/components/victim/StatusTimeline";
import StatusBadge from "@/components/ui/StatusBadge";

type Report = {
  id: string;
  phone_no: string;
  latitude: number;
  longitude: number;
  city: string;
  district: string;
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
  sender_id: string | null;
  victim_report_id: string;
  created_at: string;
  read_at: string | null;
};

const SITUATION_COLORS: Record<string, string> = {
  food: "#2ECC71",
  water: "#3B8BFF",
  medical: "#F5A623",
  rescue: "#FF3B3B",
  shelter: "#A855F7",
  missing: "#6B7280",
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatReportId(id: string, createdAt: string) {
  const year = new Date(createdAt).getFullYear();
  const shortId = id.slice(0, 4).toUpperCase();
  return `REPORT #KL-${year}-${shortId}`;
}

export default function ReportStatusPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  const {
    containerRef,
    isNearBottom,
    newMessagesCount,
    scrollToBottom,
    handleScroll,
    notifyNewMessage,
    resetNewMessagesCount,
  } = useChatScroll();

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/victim/report/${reportId}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Report not found");
        } else {
          setReport(data.report);
        }
      } catch (err) {
        console.error("Report fetch error:", err);
        setError("Failed to load report");
      }
      setLoading(false);
    };

    fetchReport();

    channelRef.current = supabase
      .channel(`victim-report-status-${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "victim_report",
          filter: `id=eq.${reportId}`,
        },
        (payload) => {
          setReport(payload.new as Report);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [reportId, supabase]);

  useEffect(() => {
    const supabase = createClient();
    
    const messagesChannel = supabase
      .channel(`victim-messages-${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message",
          filter: `victim_report_id=eq.${reportId}`,
        },
        (payload) => {
          notifyNewMessage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [reportId, notifyNewMessage, supabase]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !report) return;
    setSending(true);
    try {
      const res = await fetch("/api/victim/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim(),
          victim_report_id: reportId,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setNewMessage("");
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

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

  const borderColor = SITUATION_COLORS[report.situation] || "#FF6B2B";

  const header = (
    <div
      className="px-4 py-3 border-b border-border-dim bg-surface-1"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-orange uppercase tracking-wider">
          {formatReportId(report.id, report.created_at)}
        </span>
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
          📍 {report.city || "Unknown"}, {report.district || ""}
        </p>
        <p className="font-mono text-[10px] text-dim mt-0.5">
          Reported: {formatTime(report.created_at)} IST
        </p>
      </div>
    </div>
  );

  const inputArea = (
    <div className="px-4 py-3 border-t border-border-dim bg-surface-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors"
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          className="font-display font-semibold text-[11px] uppercase tracking-[0.1em] text-black bg-orange px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)" }}
        >
          {sending ? "..." : "SEND →"}
        </button>
      </div>
    </div>
  );

  const footerArea = (
    <div className="px-4 py-3 border-t border-border-dim bg-surface-1">
      <a
        href={`tel:${process.env.NEXT_PUBLIC_TWILIO_SMS_NUMBER}`}
        className="block w-full text-center font-[family-name:var(--font-ibm-mono)] font-medium text-[13px] uppercase tracking-[0.15em] text-black bg-orange py-3 transition-opacity hover:opacity-90"
        style={{
          clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
        }}
      >
        📞 Call Helpline: {process.env.NEXT_PUBLIC_TWILIO_SMS_NUMBER}
      </a>
    </div>
  );

  return (
    <ChatScrollArea
      header={header}
      inputArea={inputArea}
      footerArea={footerArea}
      isLoading={loading}
      showJumpToBottom={true}
      className="min-h-screen"
    >
      <StatusTimeline status={report.status} createdAt={report.created_at} />
      <div className="space-y-3 px-4 py-4">
        <p className="font-mono text-[10px] text-dim uppercase tracking-[0.15em] text-center mb-4">
          — Updates from Command —
        </p>
        <MessagesList reportId={reportId} isNearBottom={isNearBottom} onMessageReceived={notifyNewMessage} />
      </div>
    </ChatScrollArea>
  );
}

function MessagesList({ reportId, isNearBottom, onMessageReceived }: { reportId: string; isNearBottom: boolean; onMessageReceived: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/victim/report/${reportId}/messages`);
        const data = await res.json();
        if (res.ok && data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error("Messages fetch error:", err);
      }
    };

    fetchMessages();

    channelRef.current = supabase
      .channel(`messages-list-${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message",
          filter: `victim_report_id=eq.${reportId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            const updated = [...prev, newMsg];
            if (updated.length > 200) return updated.slice(-200);
            return updated;
          });
          onMessageReceived();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [reportId, supabase, onMessageReceived]);

  if (messages.length === 0) {
    return (
      <p className="font-mono text-[11px] text-dim text-center py-8">
        No messages yet. DMA will respond soon.
      </p>
    );
  }

  return (
    <>
      {messages.map((msg) => {
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
              className={`max-w-[80%] px-3 py-2 text-sm font-body ${
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
      })}
    </>
  );
}