"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface Channel {
  id: string;
  type: "victim_thread" | "taskforce_room" | "direct";
  label: string;
  subtitle: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  is_flagged: boolean;
  phone_no?: string;
  situation?: string;
  urgency?: string;
  city?: string;
  district?: string;
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

interface VictimReport {
  id: string;
  phone_no: string;
  situation: string;
  urgency: string;
  city: string;
  district: string;
  created_at: string;
  status: string;
}

interface TFMember {
  id: string;
  name: string;
  mobile_no: string;
  type: string;
  status: string;
  member_type: string;
  role: string;
}

function MessagesContent() {
  const router = useRouter();
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeChannelData, setActiveChannelData] = useState<VictimReport | null>(null);
  const [activeTab, setActiveTab] = useState<"victim" | "volunteer" | "taskforce">("victim");
  const [tfMembers, setTfMembers] = useState<TFMember[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagePanelRef = useRef<HTMLDivElement>(null);

  const messageCache = useRef<Record<string, { messages: Message[]; timestamp: number }>>({});
  const channelDataCache = useRef<Record<string, { data: VictimReport | null; timestamp: number }>>({});
  const tfMembersCache = useRef<Record<string, { members: TFMember[]; timestamp: number }>>({});
  const CACHE_TTL = 60000;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/dma/login");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [router, supabase.auth]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/dma/channels");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setChannels(data);
        }
      }
    } catch (err) {
      console.error("Error fetching channels:", err);
    }
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (forceRefresh = false) => {
    if (!activeChannel) return;
    const cacheKey = `${activeChannel.type}-${activeChannel.id}`;
    const now = Date.now();
    
    if (!forceRefresh && messageCache.current[cacheKey] && (now - messageCache.current[cacheKey].timestamp) < CACHE_TTL) {
      setMessages(messageCache.current[cacheKey].messages);
      return;
    }
    
    try {
      const res = await fetch(
        `/api/dma/message?channel_type=${activeChannel.type}&channel_id=${activeChannel.id}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          messageCache.current[cacheKey] = { messages: data, timestamp: now };
          setMessages(data);
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [activeChannel]);

  const fetchChannelData = useCallback(async (forceRefresh = false) => {
    if (!activeChannel) return;
    if (activeChannel.type === "victim_thread") {
      const cacheKey = activeChannel.id;
      const now = Date.now();
      
      if (!forceRefresh && channelDataCache.current[cacheKey] && (now - channelDataCache.current[cacheKey].timestamp) < CACHE_TTL) {
        setActiveChannelData(channelDataCache.current[cacheKey].data);
        return;
      }
      
      try {
        const res = await fetch(`/api/victim/report/${activeChannel.id}`);
        if (res.ok) {
          const data = await res.json();
          channelDataCache.current[cacheKey] = { data: data.report, timestamp: now };
          setActiveChannelData(data.report);
        }
      } catch (err) {
        console.error("Error fetching channel data:", err);
      }
    } else {
      setActiveChannelData(null);
    }
  }, [activeChannel]);

  const fetchTfMembers = useCallback(async (forceRefresh = false) => {
    if (!activeChannel || activeChannel.type !== "taskforce_room") return;
    const cacheKey = activeChannel.id;
    const now = Date.now();
    
    if (!forceRefresh && tfMembersCache.current[cacheKey] && (now - tfMembersCache.current[cacheKey].timestamp) < CACHE_TTL) {
      setTfMembers(tfMembersCache.current[cacheKey].members);
      return;
    }
    
    try {
      const res = await fetch(`/api/dma/taskforce/members?taskforce_id=${activeChannel.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          tfMembersCache.current[cacheKey] = { members: data, timestamp: now };
          setTfMembers(data);
        }
      }
    } catch (err) {
      console.error("Error fetching TF members:", err);
    }
  }, [activeChannel]);

  const markAsRead = useCallback(async () => {
    if (!activeChannel) return;
    try {
      await fetch("/api/dma/message/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_type: activeChannel.type,
          channel_id: activeChannel.id,
        }),
      });
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  }, [activeChannel]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (activeChannel) {
      Promise.all([
        fetchMessages(),
        fetchChannelData(),
        fetchTfMembers(),
        markAsRead()
      ]);
    }
  }, [activeChannel, fetchMessages, fetchChannelData, fetchTfMembers, markAsRead]);

  const handleScroll = useCallback(() => {
    if (!messagePanelRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagePanelRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom < 100);
    if (distanceFromBottom < 100) {
      setNewMessagesCount(0);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (messages.length > 0 && messagePanelRef.current) {
      if (isNearBottom) {
        messagePanelRef.current.scrollTo({ top: messagePanelRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        setNewMessagesCount(prev => prev + 1);
      }
    }
  }, [messages, isNearBottom]);

  useEffect(() => {
    if (messages.length > 0 && messagePanelRef.current && isNearBottom) {
      messagePanelRef.current.scrollTo({ top: messagePanelRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!activeChannel) return;

    let filter = "";
    if (activeChannel.type === "victim_thread") {
      filter = `victim_report_id=eq.${activeChannel.id}`;
    } else if (activeChannel.type === "taskforce_room") {
      filter = `task_force_id=eq.${activeChannel.id}`;
    } else if (activeChannel.type === "direct") {
      filter = `receiver_id=eq.${activeChannel.id}`;
    }

    const channelName = `dma-messages-${activeChannel.type}-${activeChannel.id}`;
    const cacheKey = `${activeChannel.type}-${activeChannel.id}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as const,
        {
          event: "INSERT",
          schema: "public",
          table: "message",
          filter,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            const updatedMessages = [...prev, newMsg];
            messageCache.current[cacheKey] = { messages: updatedMessages, timestamp: Date.now() };
            return updatedMessages;
          });
          if (isNearBottom) {
            setTimeout(() => scrollToBottom('smooth'), 50);
          } else {
            setNewMessagesCount(prev => prev + 1);
          }
          setChannels(prev => prev.map(ch =>
            ch.id === activeChannel.id
              ? { ...ch, last_message: newMsg.content, last_message_time: newMsg.created_at }
              : ch
          ));
        }
      )
      .on(
        "postgres_changes" as const,
        {
          event: "UPDATE",
          schema: "public",
          table: "message",
          filter,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages(prev => {
            const updatedMessages = prev.map(m => m.id === updatedMsg.id ? updatedMsg : m);
            messageCache.current[cacheKey] = { messages: updatedMessages, timestamp: Date.now() };
            return updatedMessages;
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, activeChannel, isNearBottom, scrollToBottom]);

  const handleChannelClick = (channel: Channel) => {
    if (activeChannel?.id === channel.id && activeChannel?.type === channel.type) return;
    setActiveChannel(channel);
    setTfMembers([]);
    setMessages([]);
    setActiveChannelData(null);
    setIsNearBottom(true);
    setNewMessagesCount(0);
    if (messagePanelRef.current) {
      messagePanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChannel || sending) return;
    
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: newMessage.trim(),
      sender_type: "dma",
      sender_id: null,
      receiver_id: activeChannel.type === "direct" ? activeChannel.id : null,
      task_force_id: activeChannel.type === "taskforce_room" ? activeChannel.id : null,
      victim_report_id: activeChannel.type === "victim_thread" ? activeChannel.id : null,
      is_flagged_for_dma: false,
      created_at: new Date().toISOString(),
      read_at: null,
      sender_name: "DMA Command",
      _temp: true,
    };

    setSending(true);
    setNewMessage("");

    setMessages(prev => [...prev, optimisticMessage]);
    
    if (messagePanelRef.current) {
      messagePanelRef.current.scrollTo({ top: messagePanelRef.current.scrollHeight, behavior: 'smooth' });
    }

    try {
      const res = await fetch("/api/dma/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim(),
          channel_type: activeChannel.type,
          task_force_id: activeChannel.type === "taskforce_room" ? activeChannel.id : undefined,
          victim_report_id: activeChannel.type === "victim_thread" ? activeChannel.id : undefined,
          receiver_id: activeChannel.type === "direct" ? activeChannel.id : undefined,
        }),
      });

      if (res.ok) {
        setChannels(prev => prev.map(ch =>
          ch.id === activeChannel.id
            ? { ...ch, last_message: newMessage.trim(), last_message_time: new Date().toISOString() }
            : ch
        ));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    msgs.forEach((msg) => {
      const msgDate = formatDate(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const filteredChannels = channels.filter((ch) => {
    if (activeTab === "victim") return ch.type === "victim_thread";
    if (activeTab === "volunteer") return ch.type === "direct";
    if (activeTab === "taskforce") return ch.type === "taskforce_room";
    return true;
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case "critical": return "bg-alert/20 text-alert border border-alert/40";
      case "urgent": return "bg-orange/20 text-orange border border-orange/40";
      default: return "bg-intel/20 text-intel border border-intel/40";
    }
  };

  const getSituationColor = (situation: string) => {
    switch (situation?.toLowerCase()) {
      case "rescue": return "text-red-400";
      case "food": return "text-green-400";
      case "water": return "text-blue-400";
      case "medical": return "text-yellow-400";
      case "shelter": return "text-purple-400";
      case "missing": return "text-gray-400";
      default: return "text-dim";
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case "police": return "bg-blue-accent/20 text-blue-accent";
      case "ndrf": return "bg-ops/20 text-ops";
      case "ngo": return "bg-purple/20 text-purple";
      default: return "bg-surface-3 text-dim";
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <span className="font-inter text-[11px] text-gray-400 uppercase tracking-wider">
          AUTHENTICATING...
        </span>
      </div>
    );
  }

  return (
    <div className="w-screen bg-gray-50 overflow-hidden" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex flex-1 min-h-0" style={{ paddingTop: '52px' }}>
        {/* Channel List Panel */}
        <div className="w-[280px] bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <h2 className="font-inter text-[14px] font-bold uppercase tracking-wide text-gray-900 mb-3">
              Communication Hub
            </h2>
            
            {/* Channel Type Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => { setActiveTab("victim"); setActiveChannel(null); }}
                className={`flex-1 px-2 py-1.5 font-inter text-[9px] uppercase tracking-wider transition-colors rounded ${
                  activeTab === "victim"
                    ? "bg-alert/20 text-alert border border-alert/40"
                    : "bg-surface-2 text-dim hover:text-ink border border-transparent"
                }`}
              >
                Victims
              </button>
              <button
                onClick={() => { setActiveTab("volunteer"); setActiveChannel(null); }}
                className={`flex-1 px-2 py-1.5 font-inter text-[9px] uppercase tracking-wider transition-colors rounded ${
                  activeTab === "volunteer"
                    ? "bg-orange/20 text-orange border border-orange/40"
                    : "bg-surface-2 text-dim hover:text-ink border border-transparent"
                }`}
              >
                Volunteers
              </button>
              <button
                onClick={() => { setActiveTab("taskforce"); setActiveChannel(null); }}
                className={`flex-1 px-2 py-1.5 font-inter text-[9px] uppercase tracking-wider transition-colors rounded ${
                  activeTab === "taskforce"
                    ? "bg-ops/20 text-ops border border-ops/40"
                    : "bg-surface-2 text-dim hover:text-ink border border-transparent"
                }`}
              >
                TF Groups
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredChannels.length === 0 ? (
              <div className="p-4 text-center">
                <p className="font-inter text-dim text-[10px] uppercase tracking-wider">
                  No {activeTab} channels
                </p>
              </div>
            ) : (
              <div className="py-1">
                {filteredChannels.map((channel) => (
                  <button
                    key={`${channel.type}-${channel.id}`}
                    onClick={() => handleChannelClick(channel)}
                    className={`w-full text-left p-3 border-b border-border-dim/30 transition-all duration-200 group relative overflow-hidden ${
                      activeChannel?.id === channel.id && activeChannel?.type === channel.type
                        ? "bg-surface-3 border-l-2 border-l-orange"
                        : "hover:bg-surface-2/80 border-l-2 border-l-transparent hover:border-l-orange/50"
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange/0 via-orange/5 to-orange/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Channel Header */}
                    <div className="flex items-start justify-between gap-2 mb-1.5 relative">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-inter text-[11px] font-bold transition-transform group-hover:scale-110 ${
                          channel.type === "victim_thread" ? "bg-alert/20 text-alert" :
                          channel.type === "taskforce_room" ? "bg-ops/20 text-ops" :
                          "bg-orange/20 text-orange"
                        }`}>
                          {getInitials(channel.label)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-inter text-[11px] font-semibold text-ink uppercase truncate">
                            {channel.label}
                          </span>
                          {channel.type === "direct" && (
                            <span className="font-ibm-mono text-[7px] text-orange uppercase tracking-wider">Volunteer</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {channel.is_flagged && (
                          <span className="text-alert text-[10px] animate-pulse">⚑</span>
                        )}
                        {channel.unread_count > 0 && (
                          <span className="w-5 h-5 bg-orange rounded-full flex items-center justify-center font-ibm-mono text-[9px] text-void font-bold">
                            {channel.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Channel Meta */}
                    <div className="flex items-center gap-2 mb-1">
                      {channel.type === "victim_thread" && channel.urgency && (
                        <span className={`font-ibm-mono text-[8px] uppercase px-1.5 py-0.5 rounded ${getUrgencyColor(channel.urgency)}`}>
                          {channel.urgency}
                        </span>
                      )}
                      {channel.type === "victim_thread" && channel.situation && (
                        <span className={`font-ibm-mono text-[8px] uppercase ${getSituationColor(channel.situation)}`}>
                          {channel.situation}
                        </span>
                      )}
                      <span className="font-ibm-mono text-[9px] text-dim truncate">
                        {channel.subtitle}
                      </span>
                    </div>
                    
                    {/* Last Message Preview */}
                    {channel.last_message && (
                      <p className="font-inter text-[10px] text-muted truncate leading-tight">
                        {channel.last_message}
                      </p>
                    )}
                    {channel.last_message_time && (
                      <p className="font-ibm-mono text-[8px] text-dim mt-1">
                        {formatTime(channel.last_message_time)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Thread Panel */}
        <div className="flex-1 flex flex-col bg-void min-h-0 relative">
          {activeChannel ? (
            <>
              {/* Thread Header */}
              <div className="p-4 bg-surface-1 border-b border-border-dim shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded flex items-center justify-center font-inter text-[14px] font-bold shrink-0 ${
                    activeChannel.type === "victim_thread" ? "bg-alert/20 text-alert" :
                    activeChannel.type === "taskforce_room" ? "bg-ops/20 text-ops" :
                    "bg-orange/20 text-orange"
                  }`}>
                    {getInitials(activeChannel.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-inter text-[14px] font-semibold text-ink uppercase truncate">
                      {activeChannel.label}
                    </h3>
                    <p className="font-ibm-mono text-[10px] text-dim">
                      {activeChannel.subtitle}
                    </p>
                  </div>
                  
                  {activeChannelData && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-ibm-mono text-[9px] uppercase px-2 py-1 rounded ${getUrgencyColor(activeChannelData.urgency)}`}>
                          {activeChannelData.urgency}
                        </span>
                        <span className={`font-ibm-mono text-[9px] uppercase ${getSituationColor(activeChannelData.situation)}`}>
                          {activeChannelData.situation}
                        </span>
                      </div>
                      <p className="font-ibm-mono text-[9px] text-dim">
                        📍 {activeChannelData.city}, {activeChannelData.district}
                      </p>
                      <p className="font-ibm-mono text-[9px] text-muted">
                        📞 {activeChannelData.phone_no}
                      </p>
                    </div>
                  )}

                  {activeChannel.type === "direct" && activeChannel.phone_no && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`font-ibm-mono text-[9px] uppercase px-2 py-1 rounded ${getTypeBadgeColor(activeChannel.subtitle?.split('·')[0]?.trim() || '')}`}>
                        Volunteer
                      </span>
                      <p className="font-ibm-mono text-[9px] text-muted">
                        📞 {activeChannel.phone_no}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* TF Members Panel - Separate from header to prevent layout shift */}
              {activeChannel.type === "taskforce_room" && tfMembers.length > 0 && (
                <div className="bg-surface-2 border-b border-border-dim p-3 shrink-0">
                  <p className="font-ibm-mono text-[9px] text-dim uppercase tracking-wider mb-2">👥 Team Members ({tfMembers.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {tfMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 bg-surface-1 px-2 py-1.5"
                        style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                          member.status === 'active' ? 'bg-ops/20 text-ops' : 'bg-surface-3 text-dim'
                        }`}>
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-inter text-[11px] text-ink block truncate max-w-[80px]">{member.name}</span>
                          <span className={`font-ibm-mono text-[7px] px-1 py-0.5 uppercase ${getTypeBadgeColor(member.type)}`}>
                            {member.type?.slice(0, 3)}
                          </span>
                        </div>
                        {member.mobile_no && (
                          <span className="font-ibm-mono text-[8px] text-dim shrink-0">{member.mobile_no}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div ref={messagePanelRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                    <p className="font-inter text-dim text-[11px] uppercase tracking-wider">
                      No messages yet
                    </p>
                    <p className="font-ibm-mono text-dim text-[10px] mt-1">
                      Start the conversation
                    </p>
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((group) => (
                    <div key={group.date}>
                      {/* Date Divider */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border-dim" />
                        <span className="font-ibm-mono text-[9px] text-dim uppercase tracking-wider px-2 py-0.5 bg-surface-2">
                          {group.date}
                        </span>
                        <div className="flex-1 h-px bg-border-dim" />
                      </div>
                      
                      {/* Messages */}
                      <div className="space-y-3">
                        {group.messages.map((msg) => {
                          const isDma = msg.sender_type === "dma";
                          const isFlagged = msg.is_flagged_for_dma;
                          const isUnread = !msg.read_at && !isDma;

                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isDma ? "justify-end" : "justify-start"} ${
                                isFlagged ? "bg-alert/5 -mx-2 px-2 py-2 rounded-lg border border-alert/20" : ""
                              }`}
                            >
                              <div className={`max-w-[75%] ${isDma ? "items-end" : "items-start"}`}>
                                {/* Sender Label */}
                                {!isDma && (
                                  <div className="flex items-center gap-2 mb-1.5 ml-1">
                                    <span className={`font-inter text-[10px] font-semibold uppercase ${
                                      isUnread ? "text-orange" : "text-muted"
                                    }`}>
                                      {msg.sender_name || "Unknown"}
                                    </span>
                                    {isUnread && (
                                      <span className="w-2 h-2 bg-orange rounded-full animate-pulse" />
                                    )}
                                  </div>
                                )}

                                {/* DMA Badge */}
                                {isDma && (
                                  <div className="flex items-center gap-1 mb-1.5 justify-end mr-1">
                                    <span className="font-ibm-mono text-[8px] text-orange uppercase tracking-widest bg-orange/20 px-2 py-0.5 rounded">
                                      🟧 DMA COMMAND
                                    </span>
                                  </div>
                                )}

                                {/* Message Bubble */}
                                <div
                                  className={`relative px-5 py-3.5 transition-all duration-200 message-bubble ${
                                    isDma
                                      ? "bg-gradient-to-br from-orange to-orange/90 text-void shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                                      : "bg-surface-3 text-ink border border-border-dim/50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                                  } ${isFlagged ? "ring-2 ring-alert/50 ring-offset-2 ring-offset-void" : ""}`}
                                  style={{
                                    clipPath: isDma
                                      ? "polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)"
                                      : "polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)",
                                  }}
                                >
                                  <p className="font-inter text-[14px] leading-relaxed whitespace-pre-wrap">
                                    {msg.content}
                                  </p>
                                  {isDma && (
                                    <div className="absolute -bottom-px right-4 w-4 h-4 bg-orange/90 overflow-hidden">
                                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange/50 to-transparent" />
                                    </div>
                                  )}
                                </div>

                                {/* Message Meta */}
                                <div className={`flex items-center gap-2 mt-1.5 ${isDma ? "justify-end" : "justify-start"} mx-1`}>
                                  <span className="font-ibm-mono text-[9px] text-dim/80">
                                    {formatTime(msg.created_at)}
                                  </span>
                                  {isFlagged && (
                                    <span className="font-ibm-mono text-[9px] text-alert uppercase tracking-wider flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 2L12.5 8.5L19.5 9.5L14.5 14L16 21L10 17.5L4 21L5.5 14L0.5 9.5L7.5 8.5L10 2Z"/>
                                      </svg>
                                      Flagged
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Jump to Bottom Button */}
              {!isNearBottom && newMessagesCount > 0 && (
                <button
                  onClick={() => {
                    scrollToBottom('smooth');
                    setNewMessagesCount(0);
                  }}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange to-orange/90 text-void px-5 py-2.5 rounded-full font-inter text-[11px] font-bold tracking-wide shadow-[0_4px_20px_rgba(249,115,22,0.4)] hover:scale-105 hover:shadow-[0_6px_30px_rgba(249,115,22,0.5)] active:scale-95 transition-all duration-200 flex items-center gap-2 z-10 animate-bounce-subtle"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                >
                  <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M19 14L12 21L5 14M19 14L12 7L5 14" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''}
                </button>
              )}

              {/* Message Input */}
              <div className="p-4 bg-surface-1/80 backdrop-blur-xl border-t border-border-dim/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !sending && handleSendMessage()}
                      placeholder={`Message ${activeChannel.label}...`}
                      className="w-full px-5 py-4 bg-surface-2/80 border border-border-dim/30 rounded-lg font-inter text-[14px] text-ink placeholder:text-dim/60 focus:outline-none focus:border-orange/50 focus:ring-2 focus:ring-orange/20 transition-all"
                    />
                    <div className="absolute inset-0 rounded-lg pointer-events-none bg-gradient-to-r from-orange/5 via-transparent to-transparent opacity-0 focus-within:opacity-100 transition-opacity" />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className={`relative px-8 py-4 font-inter font-bold text-[12px] uppercase tracking-[0.1em] transition-all duration-300 ${
                      newMessage.trim() && !sending
                        ? "bg-orange text-void hover:bg-orange/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] active:scale-95"
                        : "bg-surface-3 text-dim/50 cursor-not-allowed"
                    }`}
                    style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
                  >
                    {sending ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                        </svg>
                        Sending
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Send
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange/5 via-transparent to-transparent opacity-50" />
              <div className="w-24 h-24 bg-surface-2/50 rounded-2xl flex items-center justify-center mb-6 border border-border-dim/30 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="font-inter text-[16px] text-dim uppercase tracking-[0.2em] mb-3">
                Select a Channel
              </p>
              <p className="font-ibm-mono text-[11px] text-dim/60">
                Choose from Victim Reports, Volunteers, or TF Groups
              </p>
              <div className="mt-8 flex items-center gap-6">
                <div className="flex items-center gap-2 text-dim/40">
                  <div className="w-2 h-2 rounded-full bg-alert/60" />
                  <span className="font-ibm-mono text-[9px] uppercase">Critical</span>
                </div>
                <div className="flex items-center gap-2 text-dim/40">
                  <div className="w-2 h-2 rounded-full bg-ops/60" />
                  <span className="font-ibm-mono text-[9px] uppercase">Active</span>
                </div>
                <div className="flex items-center gap-2 text-dim/40">
                  <div className="w-2 h-2 rounded-full bg-orange/60" />
                  <span className="font-ibm-mono text-[9px] uppercase">Direct</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-void">
        <span className="font-inter text-[11px] text-dim uppercase tracking-wider">
          LOADING...
        </span>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}
