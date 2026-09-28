'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, PanelLeft, PanelRight,
  Plus, Sparkles, Trash2,
  MapPin, Users, AlertTriangle, Package
} from 'lucide-react';
import Button from '@/components/ui/Button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

const SUGGESTED_QUERIES = [
  { icon: AlertTriangle, label: 'Show critical reports', query: 'List all critical priority reports that are still open' },
  { icon: MapPin, label: 'Active hotspots', query: 'Which districts have the most unresolved reports right now?' },
  { icon: Users, label: 'Available medics', query: 'Find all volunteers with medical skills who are currently active' },
  { icon: Package, label: 'Low stock alerts', query: 'Which resources are at or below their low stock threshold, counting active allocations?' },
];

let localId = 0;
const nextId = () => `local-${++localId}`;

export function AIAssistantDrawer({ isOpen, onClose }: AIAssistantDrawerProps) {
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = useCallback(async (): Promise<ChatSession[]> => {
    try {
      const res = await fetch('/api/dma/chat/sessions', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch('/api/dma/chat/sessions', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentSessionId(data.id);
      setMessages([]);
      setError(null);
      void fetchSessions();
    } catch {
      setError('Could not start a new briefing.');
    }
  }, [fetchSessions]);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setCurrentSessionId(sessionId);
      setError(null);
      const res = await fetch(`/api/dma/chat/sessions/${sessionId}/messages`, { cache: 'no-store' });
      const data = await res.json();
      setMessages(
        Array.isArray(data)
          ? data.map((m: { id?: string; role: 'user' | 'assistant'; content: string }) => ({ id: m.id || nextId(), role: m.role, content: m.content }))
          : []
      );
      setShowSessions(false);
    } catch {
      setError('Could not load that briefing.');
    }
  }, []);

  // First open: reuse the latest empty briefing instead of piling up blank ones.
  useEffect(() => {
    if (!isOpen || currentSessionId || initializingRef.current) return;
    initializingRef.current = true;

    void (async () => {
      const list = await fetchSessions();
      const latest = list[0];
      if (latest && latest.message_count === 0) {
        setCurrentSessionId(latest.id);
      } else {
        await createNewSession();
      }
      initializingRef.current = false;
    })();
  }, [isOpen, currentSessionId, fetchSessions, createNewSession]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, [isOpen]);

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm('Delete this briefing?')) return;
    await fetch(`/api/dma/chat/sessions/${sessionId}/messages`, { method: 'DELETE' });
    const list = await fetchSessions();
    if (sessionId === currentSessionId) {
      setMessages([]);
      if (list[0]) void loadSession(list[0].id);
      else void createNewSession();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading || !currentSessionId) return;

    const userMessage: Message = { id: nextId(), role: 'user', content };
    const assistantId = nextId();
    const history = [...messages, userMessage];

    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dma/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId: currentSessionId }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || 'DRIS is unavailable right now.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const snapshot = text;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)));
      }

      void fetchSessions();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content));
      setError(err instanceof Error ? err.message : 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const waitingForFirstToken = isLoading && lastMessage?.role === 'assistant' && !lastMessage.content;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-[52px] right-0 bottom-0 w-[380px] max-w-full bg-white border-l border-border-dim z-50 flex flex-col shadow-2xl"
            role="dialog"
            aria-label="DRIS Intelligence assistant"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border-dim bg-gradient-to-r from-white to-gray-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSessions(!showSessions)}
                  className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors"
                  title={showSessions ? 'Hide briefings' : 'Show briefings'}
                  aria-label={showSessions ? 'Hide briefings' : 'Show briefings'}
                >
                  {showSessions ? <PanelRight className="w-4 h-4 text-dim" /> : <PanelLeft className="w-4 h-4 text-dim" />}
                </button>
                <div>
                  <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.12em] text-ink">
                    DRIS Intelligence
                  </h2>
                  <p className="font-mono text-[9px] text-dim uppercase tracking-wider">
                    Disaster Response AI Core
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void createNewSession()}
                  className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors"
                  title="New Briefing"
                  aria-label="New briefing"
                >
                  <Plus className="w-4 h-4 text-dim" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors"
                  aria-label="Close assistant"
                >
                  <X className="w-4 h-4 text-dim" />
                </button>
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              <AnimatePresence>
                {showSessions && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 180, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="border-r border-border-dim bg-gray-50/50 overflow-hidden flex flex-col"
                  >
                    <div className="p-3 flex-1 overflow-y-auto">
                      <h3 className="font-mono text-[9px] font-bold text-dim uppercase tracking-wider mb-3">
                        Briefing History
                      </h3>
                      <div className="space-y-1">
                        {sessions.length === 0 ? (
                          <p className="font-mono text-[10px] text-dim text-center py-4">No sessions yet</p>
                        ) : (
                          sessions.map((session) => (
                            <div
                              key={session.id}
                              className={`group p-2 rounded-sm transition-all border ${
                                currentSessionId === session.id
                                  ? 'bg-orange/10 border-orange/20'
                                  : 'hover:bg-white border-transparent'
                              }`}
                            >
                              <button onClick={() => void loadSession(session.id)} className="w-full text-left">
                                <div className="font-mono text-[10px] font-semibold text-ink truncate">{session.title}</div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[9px] text-dim">{new Date(session.updated_at).toLocaleDateString('en-IN')}</span>
                                  <span className="text-[9px] text-orange font-medium">{session.message_count} msgs</span>
                                </div>
                              </button>
                              <button
                                onClick={() => void deleteSession(session.id)}
                                className="mt-1 hidden group-hover:flex items-center gap-1 text-[9px] text-dim hover:text-alert"
                                aria-label="Delete briefing"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-sm" role="alert">
                      <p className="font-mono text-[11px] text-red-600">{error}</p>
                    </div>
                  )}

                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-6 h-6 text-orange" />
                      </div>
                      <h3 className="font-display text-[16px] font-bold text-ink uppercase tracking-wide mb-2">
                        Intelligence Ready
                      </h3>
                      <p className="font-body text-[13px] text-dim mb-6">
                        Query disaster data, analyze patterns, and receive tactical recommendations.
                      </p>
                      <div className="w-full space-y-2">
                        {SUGGESTED_QUERIES.map(({ icon: Icon, label, query }) => (
                          <button
                            key={label}
                            onClick={() => {
                              setInput(query);
                              inputRef.current?.focus();
                            }}
                            className="w-full flex items-center gap-3 p-3 text-left rounded-sm border border-border-dim hover:border-orange/30 hover:bg-orange/5 transition-all group"
                          >
                            <Icon className="w-4 h-4 text-dim group-hover:text-orange transition-colors" />
                            <span className="font-mono text-[11px] text-secondary group-hover:text-ink">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) =>
                        message.role === 'assistant' && !message.content ? null : (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${
                              message.role === 'user' ? 'bg-orange text-white' : 'bg-gray-100 text-dim'
                            }`}>
                              {message.role === 'user' ? (
                                <span className="font-display text-[12px] font-bold">OP</span>
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className={`max-w-[calc(100%-44px)] px-3 py-2 rounded-sm ${
                              message.role === 'user' ? 'bg-orange text-white' : 'bg-gray-50 border border-border-dim'
                            }`}>
                              <p className={`font-body text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                                message.role === 'user' ? 'text-white' : 'text-ink'
                              }`}>
                                {message.content}
                              </p>
                            </div>
                          </motion.div>
                        )
                      )}
                      {waitingForFirstToken && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                          <div className="w-7 h-7 rounded-sm bg-gray-100 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-dim" />
                          </div>
                          <div className="px-3 py-2 bg-gray-50 border border-border-dim rounded-sm">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-orange rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-orange rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-orange rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-border-dim bg-white">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Query disaster data..."
                      disabled={isLoading}
                      maxLength={4000}
                      aria-label="Question for DRIS"
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-border-dim rounded-sm font-body text-[13px] text-ink placeholder:text-dim focus:outline-none focus:border-orange/30 focus:ring-2 focus:ring-orange/10 disabled:opacity-50"
                    />
                    <Button
                      type="submit"
                      size="small"
                      variant="primary"
                      disabled={isLoading || !input.trim() || !currentSessionId}
                      className="!px-3"
                      aria-label="Send"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  <p className="mt-2 font-mono text-[9px] text-dim/60 text-center">
                    Read-only access to reports, volunteers, missions and resources · ⌘/Ctrl+K
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
