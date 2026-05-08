'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  content: string;
  sender_type: string;
  sender_id: string;
  sender_name?: string;
  task_force_id: string;
  is_flagged_for_dma: boolean;
  created_at: string;
  read_at: string | null;
}

interface TaskForce {
  id: string;
  name: string;
  status: string;
  assignment_id: string | null;
}

interface TFMember {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function TaskForceChatPage() {
  const router = useRouter();
  const params = useParams();
  const taskforceId = params.taskforce_id as string;
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [taskForce, setTaskForce] = useState<TaskForce | null>(null);
  const [members, setMembers] = useState<TFMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/volunteer/message?taskforce_id=${taskforceId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {}
    setLoading(false);
  }, [taskforceId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tfRes, membersRes, volRes] = await Promise.all([
          fetch(`/api/dma/taskforce/${taskforceId}`),
          fetch(`/api/dma/taskforce/${taskforceId}/members`),
          fetch('/api/volunteer/me'),
        ]);

        if (tfRes.ok) {
          const tf = await tfRes.json();
          setTaskForce(tf);
        }
        if (membersRes.ok) {
          const m = await membersRes.json();
          setMembers(m);
        }
        if (volRes.ok) {
          const vol = await volRes.json();
          setCurrentUserId(vol?.id);
        }
      } catch {}

      setLoading(false);
    };

    fetchData();
    fetchMessages();
  }, [taskforceId, fetchMessages]);

  useEffect(() => {
    channelRef.current = supabase
      .channel(`tf-messages-${taskforceId}`)
      .on(
        'postgres_changes' as const,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message',
          filter: `task_force_id=eq.${taskforceId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [taskforceId, supabase, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');
    
    try {
      const res = await fetch('/api/volunteer/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageText, task_force_id: taskforceId }),
      });
      if (res.ok) {
        fetchMessages();
      }
    } catch {}
    setSending(false);
    inputRef.current?.focus();
  };

  const handleFlag = async (messageId: string) => {
    try {
      await fetch(`/api/volunteer/message/${messageId}/flag`, { method: 'PATCH' });
      fetchMessages();
    } catch {}
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'police': return 'bg-blue-accent/20 text-blue-accent';
      case 'ndrf': return 'bg-ops/20 text-ops';
      case 'ngo': return 'bg-purple/20 text-purple';
      default: return 'bg-surface-3 text-dim';
    }
  };

  const getOnlineStatus = (status: string) => {
    return status === 'active';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-void">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-dim text-xs">LOADING...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-void">
      {/* Header with member toggle */}
      <div className="sticky top-0 z-20 bg-surface-1 border-b border-border">
        <div className="flex items-center gap-3 p-3">
          <button 
            onClick={() => router.back()} 
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink transition-colors"
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
              {members.length} members
            </p>
          </div>

          <button 
            onClick={() => setShowMembers(!showMembers)}
            className={`w-8 h-8 flex items-center justify-center transition-colors ${
              showMembers ? 'text-orange' : 'text-muted hover:text-ink'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </button>
        </div>

        {/* Members Panel */}
        {showMembers && (
          <div className="border-t border-border-dim bg-surface-2 p-3">
            <p className="font-mono text-[10px] text-dim uppercase tracking-wider mb-2">Team Members</p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center gap-2 bg-surface-1 px-2 py-1"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    getOnlineStatus(member.status) ? 'bg-ops/20 text-ops' : 'bg-surface-3 text-dim'
                  }`}>
                    {getInitials(member.name)}
                  </div>
                  <span className="font-body text-[11px] text-ink">{member.name.split(' ')[0]}</span>
                  <span className={`font-mono text-[8px] px-1 py-0.5 uppercase ${getTypeColor(member.type)}`}>
                    {member.type?.slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <p className="font-mono text-dim text-xs uppercase tracking-wider">
              No messages yet
            </p>
            <p className="font-mono text-dim text-[10px] mt-1">
              Start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.sender_id === currentUserId;
              const isDMA = message.sender_type === 'dma';
              const isFlagged = message.is_flagged_for_dma;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                    isFlagged ? 'bg-alert/5 -mx-2 px-2 py-2 rounded-lg' : ''
                  }`}
                >
                  <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {/* DMA label */}
                    {isDMA && (
                      <div className={`flex items-center gap-1 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                        <span className="font-mono text-[8px] text-orange uppercase tracking-widest bg-orange/20 px-2 py-0.5">
                          🟧 DMA COMMAND
                        </span>
                      </div>
                    )}

                    {/* Sender name for volunteers */}
                    {!isDMA && !isOwn && (
                      <div className="flex items-center gap-2 mb-1 ml-1">
                        <span className="font-display text-[10px] font-semibold text-orange uppercase">
                          {message.sender_name || 'Volunteer'}
                        </span>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`relative px-4 py-2.5 ${
                        isDMA
                          ? 'bg-orange text-void'
                          : isOwn
                          ? 'bg-surface-4 text-ink'
                          : 'bg-surface-3 text-ink'
                      }`}
                      style={{
                        clipPath: isOwn 
                          ? 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'
                          : 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)'
                      }}
                    >
                      <p className="font-body text-[14px] leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>

                    {/* Time and flag */}
                    <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'} mx-1`}>
                      <span className="font-mono text-[9px] text-dim">
                        {formatTime(message.created_at)}
                      </span>
                      {isFlagged && (
                        <span className="font-mono text-[9px] text-alert">⚑ Flagged</span>
                      )}
                      {!isOwn && !isFlagged && (
                        <button
                          onClick={() => handleFlag(message.id)}
                          className="font-mono text-[9px] text-dim hover:text-alert transition-colors p-1"
                          title="Flag to DMA"
                        >
                          ⚑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <div className="max-w-2xl mx-auto p-3">
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-surface-3 px-4 py-3 pr-12 font-body text-[14px] text-ink placeholder:text-dim focus:outline-none border-l-2 border-orange"
                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
              />
              {newMessage && (
                <button
                  type="button"
                  onClick={() => setNewMessage('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-muted"
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
              className={`w-12 h-12 flex items-center justify-center transition-all ${
                newMessage.trim() 
                  ? 'bg-orange text-void hover:bg-orange/90' 
                  : 'bg-surface-3 text-dim'
              }`}
              style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-void border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
