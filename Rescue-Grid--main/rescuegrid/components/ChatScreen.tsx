'use client';

import { useState, useEffect, useRef } from 'react';
import { useMessages, ChannelType } from '@/hooks/useMessages';
import MessageBubble from './MessageBubble';

interface ChatScreenProps {
  channel: ChannelType;
  currentUserId: string;
  taskForceName?: string;
  memberCount?: number;
  onFlag?: (messageId: string) => Promise<void>;
  showInput?: boolean;
  activeMissionStrip?: React.ReactNode;
}

export default function ChatScreen({
  channel,
  currentUserId,
  taskForceName = 'CHAT',
  memberCount = 0,
  onFlag,
  showInput = true,
  activeMissionStrip,
}: ChatScreenProps) {
  const { messages, loading, error, sendMessage, formatTime } = useMessages(channel, currentUserId);
  const [input, setInput] = useState('');
  const [flagNext, setFlagNext] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleVisualViewportChange = () => {
      if (containerRef.current) {
        const height = window.visualViewport?.height ?? window.innerHeight;
        containerRef.current.style.height = `${height}px`;
      }
    };

    window.visualViewport?.addEventListener('resize', handleVisualViewportChange);
    handleVisualViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(input.trim(), flagNext);
      setInput('');
      setFlagNext(false);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFlag = async (messageId: string) => {
    if (onFlag) {
      try {
        await onFlag(messageId);
      } catch (err) {
        console.error('Failed to flag message:', err);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-void"
      style={{ height: '100dvh', overflow: 'hidden' }}
    >
      {activeMissionStrip}

      <div className="flex-shrink-0 bg-surface-1 border-b border-border-dim px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span className="font-display text-[14px] font-semibold text-ink uppercase tracking-wide">
              {taskForceName}
            </span>
            {memberCount > 0 && (
              <span className="font-mono text-[10px] text-dim">
                {memberCount} MEMBERS
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-dim">LOADING...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-mono text-[11px] text-alert mb-2">ERROR</p>
              <p className="font-mono text-[10px] text-dim">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-display text-[14px] text-ink mb-1">NO MESSAGES</p>
              <p className="font-mono text-[10px] text-dim">Start the conversation</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            formatTime={formatTime}
            onFlag={onFlag ? handleFlag : undefined}
          />
        ))}

        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {showInput && (
        <div
          className="flex-shrink-0 bg-surface-1 border-t border-border-dim p-3"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFlagNext(f => !f)}
              className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: flagNext ? 'rgba(255, 59, 59, 0.15)' : '#1A1E25',
                border: flagNext ? '1px solid #FF3B3B' : '1px solid rgba(255, 255, 255, 0.06)',
                color: flagNext ? '#FF3B3B' : '#4A505C',
                clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
              }}
              title="Flag next message"
            >
              ⚑
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${taskForceName}...`}
              className="flex-1 h-10 px-3 bg-surface-3 border-none border-b text-ink font-body text-[14px] outline-none placeholder:text-dim"
              style={{ borderBottom: '1px solid rgba(255, 107, 43, 0.15)' }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: input.trim() ? '#FF6B2B' : '#1A1E25',
                color: input.trim() ? '#000' : '#4A505C',
                clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                opacity: sending ? 0.7 : 1,
                cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              }}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                '→'
              )}
            </button>
          </div>

          {flagNext && (
            <div className="mt-2 font-mono text-[10px] text-alert">
              ⚑ Next message will be flagged for DMA
            </div>
          )}
        </div>
      )}
    </div>
  );
}
