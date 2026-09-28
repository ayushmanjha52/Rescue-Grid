'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useVolunteerSession } from '@/components/volunteer/VolunteerSessionProvider';

interface Message {
  id: string;
  content: string;
  sender_type: string;
  sender_id: string | null;
  sender_name?: string;
  task_force_id: string;
  is_flagged_for_dma: boolean;
  created_at: string;
  read_at: string | null;
}

interface TFMember {
  id: string;
  name: string;
  type: string | null;
  status: string;
}

interface TaskForce {
  id: string;
  name: string;
  status: string;
  members: TFMember[];
}

const MAX_MESSAGES = 200;

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

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

function typeColor(type: string | null) {
  switch (type?.toLowerCase()) {
    case 'police': return 'bg-blue-accent/20 text-blue-accent';
    case 'ndrf': return 'bg-ops/20 text-ops';
    case 'ngo': return 'bg-purple/20 text-purple';
    default: return 'bg-surface-3 text-dim';
  }
}

export default function TaskForceChatPage() {
  const router = useRouter();
  const params = useParams();
  const taskforceId = params.taskforce_id as string;
  const { volunteer } = useVolunteerSession();
  const currentUserId = volunteer?.id ?? null;

  const [taskForce, setTaskForce] = useState<TaskForce | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of taskForce?.members ?? []) map[m.id] = m.name;
    return map;
  }, [taskForce]);

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      const next = [...prev, message];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [tfRes, messagesRes] = await Promise.all([
          fetch(`/api/volunteer/taskforces/${taskforceId}`),
          fetch(`/api/volunteer/message?taskforce_id=${taskforceId}`),
        ]);
        if (cancelled) return;

        if (tfRes.status === 403) {
          setError('You are not a member of this task force.');
        } else if (tfRes.ok) {
          setTaskForce(await tfRes.json());
        }
        if (messagesRes.ok) {
          const data = await messagesRes.json();
          if (!cancelled) setMessages(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setError('Could not load the chat. Check your connection.');
      }
      if (!cancelled) setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [taskforceId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tf-messages-${taskforceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message', filter: `task_force_id=eq.${taskforceId}` },
        (payload) => appendMessage(payload.new as Message)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message', filter: `task_force_id=eq.${taskforceId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated, sender_name: m.sender_name } : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskforceId, appendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    setSendError('');

    try {
      const res = await fetch('/api/volunteer/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, task_force_id: taskforceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Message not sent');
      }
      appendMessage(await res.json());
      setNewMessage('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Message not sent');
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleFlag = async (messageId: string) => {
    if (!window.confirm('Flag this message for DMA Command?')) return;
    try {
      const res = await fetch(`/api/volunteer/message/${messageId}/flag`, { method: 'PATCH' });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, is_flagged_for_dma: true } : m)));
      }
    } catch {
      // offline
    }
  };

  const senderName = (message: Message) => {
    if (message.sender_type === 'dma') return 'DMA Command';
    return message.sender_name || (message.sender_id ? memberNames[message.sender_id] : undefined) || 'Volunteer';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] bg-void">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-dim text-xs">LOADING...</span>
        </div>
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="flex flex-col min-h-[calc(100dvh-7rem)] bg-void">
      <div className="sticky top-0 z-20 bg-surface-1 border-b border-border">
        <div className="flex items-center gap-3 p-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink transition-colors"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>

          <div className="w-10 h-10 bg-surface-3 flex items-center justify-center rounded-full">
            <span className="font-display text-sm font-bold text-orange">
              {taskForce?.name?.charAt(0)?.toUpperCase() || 'T'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-sm font-semibold text-ink uppercase truncate">
              {taskForce?.name || 'Task Force'}
            </h2>
            <p className="font-mono text-[10px] text-dim">
              {taskForce?.members.length ?? 0} members
              {taskForce?.status === 'dissolved' && ' · dissolved'}
            </p>
          </div>

          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`w-8 h-8 flex items-center justify-center transition-colors ${
              showMembers ? 'text-orange' : 'text-muted hover:text-ink'
            }`}
            aria-label="Show members"
            aria-expanded={showMembers}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </button>
        </div>

        {showMembers && taskForce && (
          <div className="border-t border-border-dim bg-surface-2 p-3">
            <p className="font-mono text-[10px] text-dim uppercase tracking-wider mb-2">Team Members</p>
            <div className="flex flex-wrap gap-2">
              {taskForce.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 bg-surface-1 px-2 py-1"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    member.status === 'active' || member.status === 'on-mission' ? 'bg-ops/20 text-ops' : 'bg-surface-3 text-dim'
                  }`}>
                    {initials(member.name)}
                  </div>
                  <span className="font-body text-[11px] text-ink">{member.name.split(' ')[0]}</span>
                  {member.type && (
                    <span className={`font-mono text-[8px] px-1 py-0.5 uppercase ${typeColor(member.type)}`}>
                      {member.type.slice(0, 3)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <p className="font-mono text-dim text-xs uppercase tracking-wider">
              {error || 'No messages yet'}
            </p>
            {!error && <p className="font-mono text-dim text-[10px] mt-1">Start the conversation</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = !!currentUserId && message.sender_id === currentUserId;
              const isDMA = message.sender_type === 'dma';
              const isFlagged = message.is_flagged_for_dma;
              const day = formatDay(message.created_at);
              const showDay = day !== lastDay;
              lastDay = day;

              return (
                <div key={message.id}>
                  {showDay && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-border-dim" />
                      <span className="font-mono text-[9px] text-dim uppercase tracking-wider">{day}</span>
                      <div className="flex-1 h-px bg-border-dim" />
                    </div>
                  )}
                  <div
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                      isFlagged ? 'bg-alert/5 -mx-2 px-2 py-2 rounded-lg' : ''
                    }`}
                  >
                    <div className={`max-w-[80%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {isDMA ? (
                        <span className="mb-1 font-mono text-[8px] text-orange uppercase tracking-widest bg-orange/20 px-2 py-0.5">
                          🟧 DMA COMMAND
                        </span>
                      ) : !isOwn && (
                        <span className="mb-1 ml-1 font-display text-[10px] font-semibold text-orange uppercase">
                          {senderName(message)}
                        </span>
                      )}

                      <div
                        className={`relative px-4 py-2.5 ${
                          isDMA ? 'bg-orange text-white' : isOwn ? 'bg-surface-4 text-ink' : 'bg-surface-3 text-ink'
                        }`}
                        style={{
                          clipPath: isOwn
                            ? 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'
                            : 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)'
                        }}
                      >
                        <p className="font-body text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>

                      <div className={`flex items-center gap-2 mt-1 mx-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className="font-mono text-[9px] text-dim">{formatTime(message.created_at)}</span>
                        {isFlagged && <span className="font-mono text-[9px] text-alert">⚑ Flagged</span>}
                        {!isOwn && !isFlagged && !isDMA && (
                          <button
                            onClick={() => handleFlag(message.id)}
                            className="font-mono text-[9px] text-dim hover:text-alert transition-colors p-1"
                            title="Flag to DMA"
                            aria-label="Flag message to DMA"
                          >
                            ⚑
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!error && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-border" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          <div className="max-w-2xl mx-auto p-3">
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={2000}
                  aria-label="Message"
                  className="w-full bg-surface-3 px-4 py-3 pr-12 font-body text-[14px] text-ink placeholder:text-dim focus:outline-none border-l-2 border-orange"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                />
                {newMessage && (
                  <button
                    type="button"
                    onClick={() => setNewMessage('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-muted"
                    aria-label="Clear"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                aria-label="Send"
                className={`w-12 h-12 flex items-center justify-center transition-all ${
                  newMessage.trim() ? 'bg-orange text-white hover:bg-orange/90' : 'bg-surface-3 text-dim'
                }`}
                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22,2 15,22 11,13 2,9"/>
                  </svg>
                )}
              </button>
            </form>
            {sendError && <p className="mt-1 font-mono text-[10px] text-alert" role="alert">{sendError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
