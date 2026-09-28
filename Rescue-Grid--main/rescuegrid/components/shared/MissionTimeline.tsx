'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { formatRelative, useNow } from '@/hooks/useNow';

export interface MissionUpdate {
  id: string;
  content: string;
  sender_type: string;
  sender_id: string | null;
  sender_name: string;
  is_flagged_for_dma: boolean | null;
  created_at: string;
}

interface MissionTimelineProps {
  assignmentId: string;
  /** Base URL of the updates API — `/api/volunteer/assignment/:id/updates` or `/api/dma/...`. */
  endpoint: string;
  /** Command can reply to the responders from the timeline. */
  allowReply?: boolean;
  /** Change it to force a reload (e.g. after the page posted an update itself). */
  refreshKey?: number;
  emptyText?: string;
}

/** Everything said about one mission, oldest first, updated live. */
export default function MissionTimeline({
  assignmentId,
  endpoint,
  allowReply = false,
  refreshKey = 0,
  emptyText = 'No updates yet.',
}: MissionTimelineProps) {
  const now = useNow(30000);
  const [updates, setUpdates] = useState<MissionUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUpdates(Array.isArray(data) ? data : []);
      }
    } catch {
      // offline — keep what we have
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const scheduleReload = useDebouncedCallback(() => void load(), 300);
  useRealtimeSubscription(
    [{ table: 'message', filter: `assignment_id=eq.${assignmentId}`, onInsert: scheduleReload }],
    assignmentId
  );

  const sendReply = async () => {
    const content = reply.trim();
    if (!content) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send');
      setReply('');
      setUpdates((prev) => (prev.some((u) => u.id === data.id) ? prev : [...prev, data]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {loading ? (
        <p className="font-mono text-[10px] text-dim">Loading updates…</p>
      ) : updates.length === 0 ? (
        <p className="font-mono text-[10px] text-dim">{emptyText}</p>
      ) : (
        <ol className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {updates.map((u) => {
            const fromCommand = u.sender_type === 'dma';
            return (
              <li
                key={u.id}
                className={`p-2 border-l-2 ${
                  u.is_flagged_for_dma ? 'border-alert bg-alert/5' : fromCommand ? 'border-intel bg-intel/5' : 'border-ops bg-ops/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${fromCommand ? 'text-intel' : 'text-ops'}`}>
                    {u.sender_name}
                    {u.is_flagged_for_dma && <span className="ml-1 text-alert">⚑ urgent</span>}
                  </span>
                  <time
                    dateTime={u.created_at}
                    title={new Date(u.created_at).toLocaleString('en-IN')}
                    className="font-mono text-[9px] text-dim shrink-0"
                  >
                    {formatRelative(u.created_at, now) ||
                      new Date(u.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                <p className="font-body text-[12px] text-ink whitespace-pre-wrap break-words">{u.content}</p>
              </li>
            );
          })}
        </ol>
      )}

      {allowReply && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              maxLength={2000}
              placeholder="Message the responders about this mission…"
              aria-label="Message the responders about this mission"
              className="flex-1 px-3 py-2 bg-surface-3 border border-border-dim font-body text-[13px] text-ink placeholder:text-dim focus:outline-none focus:border-orange"
            />
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={sending || !reply.trim()}
              className="px-3 py-2 bg-orange text-white font-mono text-[10px] uppercase tracking-wider disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          {error && <p className="mt-1 font-mono text-[10px] text-alert" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
