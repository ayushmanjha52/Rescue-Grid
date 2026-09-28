'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useVolunteerSession } from '@/components/volunteer/VolunteerSessionProvider';
import { formatRelative, useNow } from '@/hooks/useNow';

interface DirectMessage {
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
}

interface TaskForceSummary {
  id: string;
  name: string;
  status: string;
  member_count: number;
  last_message: { content: string; created_at: string; sender_name: string } | null;
}

const MAX_MESSAGES = 200;

function formatDay(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function VolunteerInboxPage() {
  const { volunteer } = useVolunteerSession();
  const volunteerId = volunteer?.id ?? null;
  const now = useNow(60000);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inbox' | 'taskforces'>('inbox');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [taskForces, setTaskForces] = useState<TaskForceSummary[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const appendMessage = useCallback((message: DirectMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      const next = [...prev, message];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
    if (nearBottomRef.current) requestAnimationFrame(() => scrollToBottom('smooth'));
  }, [scrollToBottom]);

  const markRead = useCallback(async () => {
    try {
      await fetch('/api/volunteer/message/direct', { method: 'PATCH' });
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    if (!volunteerId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [msgsRes, tfsRes] = await Promise.all([
          fetch('/api/volunteer/message/direct', { cache: 'no-store' }),
          fetch('/api/volunteer/taskforces', { cache: 'no-store' }),
        ]);
        const [msgsData, tfsData] = await Promise.all([
          msgsRes.ok ? msgsRes.json() : [],
          tfsRes.ok ? tfsRes.json() : [],
        ]);
        if (cancelled) return;
        setMessages(Array.isArray(msgsData) ? msgsData : []);
        setTaskForces(Array.isArray(tfsData) ? tfsData : []);
      } catch {
        // offline
      }
      if (!cancelled) {
        setLoading(false);
        requestAnimationFrame(() => scrollToBottom('instant'));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [volunteerId, scrollToBottom]);

  // Opening the DMA tab reads the conversation.
  const hasUnread = messages.some((m) => m.sender_type === 'dma' && !m.read_at);
  useEffect(() => {
    if (activeTab === 'inbox' && hasUnread) void markRead();
  }, [activeTab, hasUnread, markRead]);

  const taskForceIdsKey = taskForces.map((tf) => tf.id).sort().join(',');

  useEffect(() => {
    if (!volunteerId) return;
    const supabase = createClient();

    let channel = supabase
      .channel(`volunteer-inbox-${volunteerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message', filter: `receiver_id=eq.${volunteerId}` }, (payload) => {
        appendMessage(payload.new as DirectMessage);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message', filter: `receiver_id=eq.${volunteerId}` }, (payload) => {
        const updated = payload.new as DirectMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      });

    if (taskForceIdsKey) {
      channel = channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message', filter: `task_force_id=in.(${taskForceIdsKey})` },
        (payload) => {
          const msg = payload.new as DirectMessage;
          setTaskForces((prev) =>
            prev.map((tf) =>
              tf.id === msg.task_force_id
                ? {
                    ...tf,
                    last_message: {
                      content: msg.content,
                      created_at: msg.created_at,
                      sender_name: msg.sender_type === 'dma' ? 'DMA Command' : msg.sender_id === volunteerId ? 'You' : 'Team',
                    },
                  }
                : tf
            )
          );
        }
      );
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [volunteerId, taskForceIdsKey, appendMessage]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/volunteer/message/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, flag: urgent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Message not sent');
      }
      nearBottomRef.current = true;
      appendMessage(await res.json());
      setNewMessage('');
      setUrgent(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Message not sent');
    }
    setSending(false);
  };

  const unreadCount = messages.filter((m) => m.sender_type === 'dma' && !m.read_at).length;
  const volunteerName = volunteer?.name || 'Volunteer';

  if (loading) {
    return (
      <div className="bg-void flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-dim text-xs uppercase tracking-wider">Loading Inbox...</span>
        </div>
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="bg-void flex flex-col" style={{ height: 'calc(100dvh - 40px - 68px)' }}>
      <div className="shrink-0 bg-surface-1 border-b border-border-dim">
        <div className="p-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange/20 rounded-full flex items-center justify-center">
              <span className="font-display text-sm font-bold text-orange">{initials(volunteerName)}</span>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-ink uppercase tracking-wide">Inbox</h1>
              <p className="font-mono text-[10px] text-dim">{volunteerName}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <div className="w-8 h-8 bg-alert rounded-full flex items-center justify-center" aria-label={`${unreadCount} unread`}>
              <span className="font-mono text-[11px] font-bold text-white">{unreadCount}</span>
            </div>
          )}
        </div>

        <div className="flex px-4 pb-3 gap-2" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'inbox'}
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-3 px-4 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all clip-path-tactical ${
              activeTab === 'inbox' ? 'bg-orange text-white' : 'bg-surface-2 text-dim hover:bg-surface-3'
            }`}
          >
            💬 DMA Command {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'taskforces'}
            onClick={() => setActiveTab('taskforces')}
            className={`flex-1 py-3 px-4 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all clip-path-tactical ${
              activeTab === 'taskforces' ? 'bg-ops text-white' : 'bg-surface-2 text-dim hover:bg-surface-3'
            }`}
          >
            👥 Task Forces ({taskForces.length})
          </button>
        </div>
      </div>

      {activeTab === 'inbox' ? (
        <>
          <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                </div>
                <p className="font-display text-lg text-ink mb-1">No messages yet</p>
                <p className="font-mono text-[11px] text-dim">
                  Broadcasts and direct messages from DMA Command appear here.
                  <br />
                  You can also message Command below.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isDma = msg.sender_type === 'dma';
                  const isUnread = isDma && !msg.read_at;
                  const day = formatDay(msg.created_at);
                  const showDay = day !== lastDay;
                  lastDay = day;

                  return (
                    <div key={msg.id}>
                      {showDay && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-border-dim" />
                          <span className="font-mono text-[9px] text-dim uppercase tracking-wider px-2 py-0.5 bg-surface-2">{day}</span>
                          <div className="flex-1 h-px bg-border-dim" />
                        </div>
                      )}
                      <div className={`flex ${isDma ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[85%] p-3 ${
                            isDma ? 'bg-orange/10 border border-orange/30' : 'bg-surface-2 border border-border-dim'
                          } ${isUnread ? 'ring-2 ring-orange/50' : ''}`}
                          style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className={`font-display text-[11px] font-semibold uppercase ${isDma ? 'text-orange' : 'text-muted'}`}>
                              {isDma ? 'DMA COMMAND' : 'You'}
                              {isUnread && <span className="ml-2 font-mono text-[8px]">NEW</span>}
                              {!isDma && msg.is_flagged_for_dma && <span className="ml-2 font-mono text-[8px] text-alert">⚑ URGENT</span>}
                            </span>
                            <span className="font-mono text-[9px] text-dim">{formatRelative(msg.created_at, now)}</span>
                          </div>
                          <p className="font-body text-[14px] text-ink leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="shrink-0 border-t border-border-dim bg-surface-1 p-3">
            <div className="flex items-end gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message DMA Command..."
                maxLength={2000}
                aria-label="Message to DMA Command"
                className="flex-1 bg-surface-3 px-4 py-3 font-body text-[14px] text-ink placeholder:text-dim focus:outline-none border-l-2 border-orange"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-4 h-12 font-display font-semibold text-[12px] uppercase tracking-wider bg-orange text-white disabled:opacity-50 clip-path-tactical-sm"
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 font-mono text-[10px] text-dim uppercase tracking-wider cursor-pointer">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="accent-alert" />
              Flag as urgent for Command
            </label>
            {sendError && <p className="mt-1 font-mono text-[10px] text-alert" role="alert">{sendError}</p>}
          </form>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {taskForces.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-display text-lg text-ink mb-1">No Task Forces</p>
              <p className="font-mono text-[11px] text-dim">
                You&apos;re not assigned to any task force groups yet
              </p>
            </div>
          ) : (
            taskForces.map((tf) => (
              <Link
                key={tf.id}
                href={`/volunteer/chat/${tf.id}`}
                className={`block p-4 bg-surface-2 border-l-4 transition-colors hover:bg-surface-3 ${
                  tf.status === 'active' ? 'border-l-ops' : 'border-l-border-dim opacity-70'
                }`}
                style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-ops/20 rounded-full flex items-center justify-center shrink-0">
                    <span className="font-display text-sm font-bold text-ops">{tf.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-[14px] font-semibold text-ink uppercase truncate">{tf.name}</h3>
                      {tf.last_message && (
                        <span className="font-mono text-[9px] text-dim shrink-0">{formatRelative(tf.last_message.created_at, now)}</span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-dim">
                      {tf.member_count} members{tf.status !== 'active' && ' · dissolved'}
                    </p>
                    <p className="font-body text-[12px] text-muted truncate mt-0.5">
                      {tf.last_message
                        ? `${tf.last_message.sender_name}: ${tf.last_message.content}`
                        : 'No messages yet — tap to open team chat'}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
