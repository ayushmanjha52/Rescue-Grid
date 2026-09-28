"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

type ChannelType = "victim_thread" | "taskforce_room" | "direct";

interface Channel {
  id: string;
  type: ChannelType;
  label: string;
  subtitle: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  is_flagged: boolean;
  phone_no?: string;
  situation?: string;
  urgency?: string;
  status?: string;
  city?: string | null;
  district?: string | null;
}

interface Message {
  id: string;
  content: string;
  sender_type: string;
  sender_id: string | null;
  receiver_id: string | null;
  task_force_id: string | null;
  victim_report_id: string | null;
  is_flagged_for_dma: boolean;
  created_at: string;
  read_at: string | null;
  sender_name?: string;
  _temp?: boolean;
}

interface TFMember {
  id: string;
  name: string;
  mobile_no: string;
  type: string | null;
  status: string;
  member_type: string | null;
}

const TAB_FOR_TYPE: Record<ChannelType, "victim" | "volunteer" | "taskforce"> = {
  victim_thread: "victim",
  direct: "volunteer",
  taskforce_room: "taskforce",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDay(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function initials(name: string) {
  if (!name) return "??";
  return name.replace(/^TF · /, "").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function urgencyColor(urgency?: string) {
  switch (urgency?.toLowerCase()) {
    case "critical": return "bg-alert/20 text-alert border border-alert/40";
    case "urgent": return "bg-orange/20 text-orange border border-orange/40";
    default: return "bg-intel/20 text-intel border border-intel/40";
  }
}

function situationColor(situation?: string) {
  switch (situation?.toLowerCase()) {
    case "rescue": return "text-red-600";
    case "food": return "text-green-700";
    case "water": return "text-blue-600";
    case "medical": return "text-amber-700";
    case "shelter": return "text-purple-500";
    default: return "text-dim";
  }
}

function typeBadgeColor(type: string | null) {
  switch (type?.toLowerCase()) {
    case "police": return "bg-blue-accent/20 text-blue-accent";
    case "ndrf": return "bg-ops/20 text-ops";
    case "ngo": return "bg-purple/20 text-purple";
    default: return "bg-surface-3 text-dim";
  }
}

/** Does a realtime message row belong to the given channel? */
function belongsTo(message: Message, channel: Channel) {
  if (channel.type === "victim_thread") return message.victim_report_id === channel.id;
  if (channel.type === "taskforce_room") return message.task_force_id === channel.id;
  return !message.task_force_id && !message.victim_report_id && (message.receiver_id === channel.id || message.sender_id === channel.id);
}

function MessagesContent() {
  const searchParams = useSearchParams();
  // Deep links: ?tf=<task force>, ?volunteer=<volunteer>, ?report=<victim report>
  const requested = useMemo((): { type: ChannelType; id: string } | null => {
    const tf = searchParams.get("tf");
    const volunteer = searchParams.get("volunteer");
    const report = searchParams.get("report");
    if (tf) return { type: "taskforce_room", id: tf };
    if (volunteer) return { type: "direct", id: volunteer };
    if (report) return { type: "victim_thread", id: report };
    return null;
  }, [searchParams]);
  const requestedKey = requested ? `${requested.type}:${requested.id}` : null;

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [activeTab, setActiveTab] = useState<"victim" | "volunteer" | "taskforce">(requested ? TAB_FOR_TYPE[requested.type] : "victim");
  const [channelSearch, setChannelSearch] = useState("");
  const [tfMembers, setTfMembers] = useState<TFMember[]>([]);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messagePanelRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const deepLinkHandled = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagePanelRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/channels", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setChannels(data);
      }
    } catch {
      // keep last list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  // Open the deep-linked channel once the list has loaded (and again if the link changes).
  useEffect(() => {
    if (!requested || deepLinkHandled.current === requestedKey || channels.length === 0) return;
    const channel = channels.find((c) => c.type === requested.type && c.id === requested.id);
    deepLinkHandled.current = requestedKey;
    if (channel) {
      setActiveTab(TAB_FOR_TYPE[channel.type]);
      setActiveChannel(channel);
    }
  }, [requested, requestedKey, channels]);

  // New messages anywhere refresh unread counts / ordering (debounced).
  const scheduleChannelRefresh = useDebouncedCallback(() => void fetchChannels(), 1500);
  useRealtimeSubscription([
    { table: "message", onInsert: scheduleChannelRefresh },
    { table: "victim_report", onInsert: scheduleChannelRefresh },
  ]);

  const markAsRead = useCallback(async (channel: Channel) => {
    setChannels((prev) => prev.map((c) => (c.id === channel.id && c.type === channel.type ? { ...c, unread_count: 0, is_flagged: false } : c)));
    try {
      await fetch("/api/dma/message/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_type: channel.type, channel_id: channel.id }),
      });
    } catch {
      // will be retried next time the channel is opened
    }
  }, []);

  const activeKey = activeChannel ? `${activeChannel.type}:${activeChannel.id}` : null;

  // Load the open channel's history (+ roster for task forces).
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    const channel = activeChannel;

    const load = async () => {
      setMessagesLoading(true);
      try {
        const [messagesRes, membersRes] = await Promise.all([
          fetch(`/api/dma/message?channel_type=${channel.type}&channel_id=${channel.id}`, { cache: "no-store" }),
          channel.type === "taskforce_room"
            ? fetch(`/api/dma/taskforce/members?taskforce_id=${channel.id}`, { cache: "no-store" })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (messagesRes.ok) {
          const data = await messagesRes.json();
          setMessages(Array.isArray(data) ? data : []);
        }
        if (membersRes?.ok) {
          const data = await membersRes.json();
          setTfMembers(Array.isArray(data) ? data : []);
        }
      } catch {
        // offline
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
          nearBottomRef.current = true;
          requestAnimationFrame(() => scrollToBottom("instant"));
        }
      }
    };

    void load();
    void markAsRead(channel);
    return () => {
      cancelled = true;
    };
    // activeKey identifies the channel; the object itself changes on list refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, markAsRead, scrollToBottom]);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of tfMembers) map[m.id] = m.name;
    return map;
  }, [tfMembers]);

  // Live messages for the open channel.
  useEffect(() => {
    if (!activeChannel) return;
    const channel = activeChannel;
    const supabase = createClient();

    const nameFor = (msg: Message) => {
      if (msg.sender_type === "dma") return "DMA Command";
      if (msg.sender_type === "victim") return channel.phone_no || "Victim";
      if (channel.type === "direct") return channel.label;
      return (msg.sender_id && memberNames[msg.sender_id]) || "Volunteer";
    };

    const onInsert = (payload: { new: Record<string, unknown> }) => {
      const msg = payload.new as unknown as Message;
      if (!belongsTo(msg, channel)) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, sender_name: nameFor(msg) }];
      });
      if (msg.sender_type !== "dma") {
        if (nearBottomRef.current) void markAsRead(channel);
      }
      if (nearBottomRef.current) requestAnimationFrame(() => scrollToBottom("smooth"));
      else setNewMessagesCount((c) => c + 1);
    };

    const onUpdate = (payload: { new: Record<string, unknown> }) => {
      const msg = payload.new as unknown as Message;
      if (!belongsTo(msg, channel)) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg, sender_name: m.sender_name } : m)));
    };

    const filters =
      channel.type === "victim_thread"
        ? [`victim_report_id=eq.${channel.id}`]
        : channel.type === "taskforce_room"
          ? [`task_force_id=eq.${channel.id}`]
          : [`receiver_id=eq.${channel.id}`, `sender_id=eq.${channel.id}`];

    let realtime = supabase.channel(`dma-messages-${channel.type}-${channel.id}`);
    for (const filter of filters) {
      realtime = realtime
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "message", filter }, onInsert)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "message", filter }, onUpdate);
    }
    realtime.subscribe();

    return () => {
      supabase.removeChannel(realtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, memberNames, markAsRead, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = messagePanelRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    nearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessagesCount(0);
  }, []);

  const selectChannel = (channel: Channel) => {
    if (activeChannel?.id === channel.id && activeChannel.type === channel.type) return;
    setActiveChannel(channel);
    setMessages([]);
    setTfMembers([]);
    setNewMessagesCount(0);
    setIsNearBottom(true);
    setSendError("");
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !activeChannel || sending) return;
    const channel = activeChannel;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      content,
      sender_type: "dma",
      sender_id: null,
      receiver_id: channel.type === "direct" ? channel.id : null,
      task_force_id: channel.type === "taskforce_room" ? channel.id : null,
      victim_report_id: channel.type === "victim_thread" ? channel.id : null,
      is_flagged_for_dma: false,
      created_at: new Date().toISOString(),
      read_at: null,
      sender_name: "DMA Command",
      _temp: true,
    };

    setSending(true);
    setSendError("");
    setNewMessage("");
    setMessages((prev) => [...prev, optimistic]);
    nearBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom("smooth"));

    try {
      const res = await fetch("/api/dma/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          channel_type: channel.type,
          task_force_id: channel.type === "taskforce_room" ? channel.id : undefined,
          victim_report_id: channel.type === "victim_thread" ? channel.id : undefined,
          receiver_id: channel.type === "direct" ? channel.id : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to send");
      const saved = (await res.json()) as Message;

      // Swap the placeholder for the saved row (realtime may already have added it).
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
      });
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id && c.type === channel.type ? { ...c, last_message: content, last_message_time: saved.created_at } : c))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
      setSendError("Message not sent — check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const tabCounts = useMemo(() => {
    const counts = { victim: 0, volunteer: 0, taskforce: 0 };
    for (const c of channels) counts[TAB_FOR_TYPE[c.type]] += c.unread_count;
    return counts;
  }, [channels]);

  const query = channelSearch.trim().toLowerCase();
  const filteredChannels = channels.filter(
    (ch) =>
      TAB_FOR_TYPE[ch.type] === activeTab &&
      (!query || ch.label.toLowerCase().includes(query) || ch.subtitle.toLowerCase().includes(query) || (ch.phone_no || "").includes(query))
  );

  let lastDay = "";

  return (
    <div className="w-screen bg-gray-50 overflow-hidden" style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <div className="flex flex-1 min-h-0" style={{ paddingTop: "52px" }}>
        {/* Channel list: full width on phones (hidden while a conversation is open), a side column from md up. */}
        <div
          className={`w-full md:w-[300px] bg-white border-r border-gray-100 flex-col shrink-0 overflow-hidden ${
            activeChannel ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-3 border-b border-gray-100 space-y-3">
            <h2 className="font-inter text-[14px] font-bold uppercase tracking-wide text-gray-900">Communication Hub</h2>

            <div className="flex gap-1" role="tablist">
              {([
                ["victim", "Victims", "bg-alert/20 text-alert border-alert/40"],
                ["volunteer", "Volunteers", "bg-orange/20 text-orange border-orange/40"],
                ["taskforce", "TF Groups", "bg-ops/20 text-ops border-ops/40"],
              ] as const).map(([key, label, activeClasses]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 px-2 py-1.5 font-inter text-[9px] uppercase tracking-wider transition-colors rounded border ${
                    activeTab === key ? activeClasses : "bg-surface-2 text-dim hover:text-ink border-transparent"
                  }`}
                >
                  {label}
                  {tabCounts[key] > 0 && <span className="ml-1 font-bold">({tabCounts[key]})</span>}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Search name, place or phone..."
              aria-label="Search channels"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-sm font-inter text-[12px] focus:outline-none focus:border-orange"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-50 animate-pulse" />)}
              </div>
            ) : filteredChannels.length === 0 ? (
              <p className="p-4 text-center font-inter text-dim text-[10px] uppercase tracking-wider">No channels</p>
            ) : (
              <div className="py-1">
                {filteredChannels.map((channel) => {
                  const isActive = activeChannel?.id === channel.id && activeChannel.type === channel.type;
                  return (
                    <button
                      key={`${channel.type}-${channel.id}`}
                      onClick={() => selectChannel(channel)}
                      className={`w-full text-left p-3 border-b border-border-dim transition-colors border-l-2 ${
                        isActive ? "bg-surface-3 border-l-orange" : "hover:bg-surface-2 border-l-transparent hover:border-l-orange/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded flex items-center justify-center font-inter text-[11px] font-bold shrink-0 ${
                            channel.type === "victim_thread" ? "bg-alert/20 text-alert" : channel.type === "taskforce_room" ? "bg-ops/20 text-ops" : "bg-orange/20 text-orange"
                          }`}>
                            {initials(channel.label)}
                          </div>
                          <span className="font-inter text-[11px] font-semibold text-ink uppercase truncate">{channel.label}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {channel.is_flagged && <span className="text-alert text-[10px] animate-pulse" title="Flagged">⚑</span>}
                          {channel.unread_count > 0 && (
                            <span className="min-w-5 h-5 px-1 bg-orange rounded-full flex items-center justify-center font-ibm-mono text-[9px] text-white font-bold">
                              {channel.unread_count}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        {channel.type === "victim_thread" && channel.urgency && (
                          <span className={`font-ibm-mono text-[8px] uppercase px-1.5 py-0.5 rounded ${urgencyColor(channel.urgency)}`}>{channel.urgency}</span>
                        )}
                        {channel.type === "victim_thread" && channel.situation && (
                          <span className={`font-ibm-mono text-[8px] uppercase ${situationColor(channel.situation)}`}>{channel.situation}</span>
                        )}
                        <span className="font-ibm-mono text-[9px] text-dim truncate">{channel.subtitle}</span>
                      </div>

                      {channel.last_message && (
                        <p className="font-inter text-[10px] text-muted truncate leading-tight">{channel.last_message}</p>
                      )}
                      {channel.last_message_time && (
                        <p className="font-ibm-mono text-[8px] text-dim mt-1">
                          {formatDay(channel.last_message_time)} {formatTime(channel.last_message_time)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Thread: full screen on phones once a conversation is chosen. */}
        <div className={`flex-1 flex-col bg-void min-h-0 relative ${activeChannel ? "flex" : "hidden md:flex"}`}>
          {activeChannel ? (
            <>
              <div className="p-4 bg-surface-1 border-b border-border-dim shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveChannel(null)}
                    className="md:hidden -ml-1 w-9 h-9 flex items-center justify-center text-muted hover:text-orange shrink-0"
                    aria-label="Back to conversations"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className={`w-12 h-12 rounded flex items-center justify-center font-inter text-[14px] font-bold shrink-0 ${
                    activeChannel.type === "victim_thread" ? "bg-alert/20 text-alert" : activeChannel.type === "taskforce_room" ? "bg-ops/20 text-ops" : "bg-orange/20 text-orange"
                  }`}>
                    {initials(activeChannel.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-inter text-[14px] font-semibold text-ink uppercase truncate">{activeChannel.label}</h3>
                    <p className="font-ibm-mono text-[10px] text-dim truncate">
                      {activeChannel.subtitle}
                      {activeChannel.type === "victim_thread" && (
                        <span className="lg:hidden uppercase">
                          {activeChannel.urgency && ` · ${activeChannel.urgency}`}
                          {activeChannel.situation && ` · ${activeChannel.situation}`}
                        </span>
                      )}
                    </p>
                  </div>

                  {activeChannel.type === "victim_thread" && (
                    <div className="hidden lg:flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-2">
                        {activeChannel.urgency && (
                          <span className={`font-ibm-mono text-[9px] uppercase px-2 py-1 rounded ${urgencyColor(activeChannel.urgency)}`}>{activeChannel.urgency}</span>
                        )}
                        <span className={`font-ibm-mono text-[9px] uppercase ${situationColor(activeChannel.situation)}`}>{activeChannel.situation}</span>
                      </div>
                      {activeChannel.status && <p className="font-ibm-mono text-[9px] text-dim uppercase">Status: {activeChannel.status.replace("_", " ")}</p>}
                    </div>
                  )}

                  {activeChannel.phone_no && (
                    <a
                      href={`tel:${activeChannel.phone_no}`}
                      aria-label={`Call ${activeChannel.phone_no}`}
                      title={activeChannel.phone_no}
                      className="shrink-0 px-3 py-2 border border-border-dim rounded-sm font-ibm-mono text-[10px] text-muted hover:text-orange hover:border-orange"
                    >
                      📞<span className="hidden lg:inline"> {activeChannel.phone_no}</span>
                    </a>
                  )}
                </div>
              </div>

              {activeChannel.type === "taskforce_room" && tfMembers.length > 0 && (
                <div className="bg-surface-2 border-b border-border-dim p-3 shrink-0">
                  <p className="font-ibm-mono text-[9px] text-dim uppercase tracking-wider mb-2">👥 Team Members ({tfMembers.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {tfMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 bg-surface-1 px-2 py-1.5 clip-path-tactical-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                          member.status === "active" || member.status === "on-mission" ? "bg-ops/20 text-ops" : "bg-surface-3 text-dim"
                        }`}>
                          {initials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-inter text-[11px] text-ink block truncate max-w-[100px]">
                            {member.name}{member.member_type === "leader" && " ★"}
                          </span>
                          {member.type && <span className={`font-ibm-mono text-[7px] px-1 py-0.5 uppercase ${typeBadgeColor(member.type)}`}>{member.type.slice(0, 3)}</span>}
                        </div>
                        {member.mobile_no && <a href={`tel:${member.mobile_no}`} className="font-ibm-mono text-[8px] text-dim hover:text-orange shrink-0">{member.mobile_no}</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagePanelRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 min-h-0">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="font-inter text-dim text-[11px] uppercase tracking-wider">No messages yet</p>
                    <p className="font-ibm-mono text-dim text-[10px] mt-1">Start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isDma = msg.sender_type === "dma";
                      const isFlagged = msg.is_flagged_for_dma;
                      const day = formatDay(msg.created_at);
                      const showDay = day !== lastDay;
                      lastDay = day;

                      return (
                        <div key={msg.id}>
                          {showDay && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border-dim" />
                              <span className="font-ibm-mono text-[9px] text-dim uppercase tracking-wider px-2 py-0.5 bg-surface-2">{day}</span>
                              <div className="flex-1 h-px bg-border-dim" />
                            </div>
                          )}
                          <div className={`flex ${isDma ? "justify-end" : "justify-start"} ${isFlagged ? "bg-alert/5 -mx-2 px-2 py-2 rounded-lg border border-alert/20" : ""}`}>
                            <div className={`max-w-[75%] flex flex-col ${isDma ? "items-end" : "items-start"}`}>
                              <span className={`mb-1 font-inter text-[10px] font-semibold uppercase ${isDma ? "text-orange" : "text-muted"}`}>
                                {isDma ? "🟧 DMA Command" : msg.sender_name || "Unknown"}
                              </span>
                              <div
                                className={`px-4 py-3 ${isDma ? "bg-orange text-white" : "bg-surface-3 text-ink border border-border-dim"} ${msg._temp ? "opacity-60" : ""}`}
                                style={{
                                  clipPath: isDma
                                    ? "polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)"
                                    : "polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)",
                                }}
                              >
                                <p className="font-inter text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1 mx-1">
                                <span className="font-ibm-mono text-[9px] text-dim">{msg._temp ? "Sending…" : formatTime(msg.created_at)}</span>
                                {isFlagged && <span className="font-ibm-mono text-[9px] text-alert uppercase tracking-wider">⚑ Flagged</span>}
                                {isDma && !msg._temp && msg.read_at && <span className="font-ibm-mono text-[9px] text-ops">✓ Read</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!isNearBottom && newMessagesCount > 0 && (
                <button
                  onClick={() => {
                    scrollToBottom("smooth");
                    setNewMessagesCount(0);
                  }}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-orange text-white px-5 py-2.5 rounded-full font-inter text-[11px] font-bold shadow-lg z-10"
                >
                  ↓ {newMessagesCount} new message{newMessagesCount > 1 ? "s" : ""}
                </button>
              )}

              <form
                className="p-4 bg-surface-1 border-t border-border-dim shrink-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendMessage();
                }}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message ${activeChannel.label}...`}
                    maxLength={2000}
                    aria-label="Message"
                    className="flex-1 min-w-0 px-4 sm:px-5 py-4 bg-surface-2 border border-border-dim rounded-lg font-inter text-[14px] text-ink placeholder:text-dim focus:outline-none focus:border-orange/50 focus:ring-2 focus:ring-orange/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className={`shrink-0 px-4 sm:px-8 py-4 font-inter font-bold text-[12px] uppercase tracking-[0.1em] transition-all clip-path-tactical ${
                      newMessage.trim() && !sending ? "bg-orange text-white hover:bg-orange/90" : "bg-surface-3 text-dim cursor-not-allowed"
                    }`}
                  >
                    {sending ? "Sending" : "Send"}
                  </button>
                </div>
                {sendError && <p className="mt-2 font-ibm-mono text-[10px] text-alert" role="alert">{sendError}</p>}
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-24 h-24 bg-surface-2 rounded-2xl flex items-center justify-center mb-6 border border-border-dim">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="font-inter text-[16px] text-dim uppercase tracking-[0.2em] mb-3">Select a Channel</p>
              <p className="font-ibm-mono text-[11px] text-dim">Choose from victim reports, volunteers, or task force groups</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-void">
          <span className="font-inter text-[11px] text-dim uppercase tracking-wider">LOADING...</span>
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
