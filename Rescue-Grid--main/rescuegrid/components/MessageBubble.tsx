'use client';

import { Message } from '@/hooks/useMessages';

interface MessageBubbleProps {
  message: Message;
  formatTime: (dateStr: string) => string;
  onFlag?: (messageId: string) => void;
}

export default function MessageBubble({ message, formatTime, onFlag }: MessageBubbleProps) {
  const isDMA = message.sender_type === 'dma';

  if (message.is_own) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div
            className="px-4 py-3 rounded-lg"
            style={{
              background: 'rgba(255, 107, 43, 0.1)',
              border: '1px solid rgba(255, 107, 43, 0.2)',
              borderRadius: '8px 2px 8px 8px',
              borderLeft: message.is_flagged_for_dma ? '3px solid #FF3B3B' : undefined,
            }}
          >
            <p className="font-body text-sm text-gray-800 leading-relaxed">
              {message.content}
            </p>
          </div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <span className="font-mono text-[10px] text-gray-400">
              {formatTime(message.created_at)}
            </span>
            {message.read_at ? (
              <span className="font-mono text-[10px] text-green-500">✓✓</span>
            ) : (
              <span className="font-mono text-[10px] text-gray-400">✓</span>
            )}
          </div>
          {message.is_flagged_for_dma && (
            <div className="font-mono text-[10px] text-red-500 text-right mt-0.5">
              ⚑ FLAGGED FOR DMA
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start">
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold"
        style={{
          background: isDMA ? 'rgba(255, 107, 43, 0.1)' : '#f3f4f6',
          border: isDMA ? '1px solid rgba(255, 107, 43, 0.3)' : '1px solid #e5e7eb',
          color: isDMA ? '#FF6B2B' : '#6b7280',
        }}
      >
        {message.sender_initials || '??'}
      </div>
      <div className="max-w-[75%]">
        {message.is_private && (
          <div className="font-mono text-[10px] text-orange mb-1 tracking-wider">
            → {message.receiver_id ? 'PRIVATE REPLY' : ''}
          </div>
        )}
        <div
          className="px-4 py-3 rounded-lg"
          style={{
            background: isDMA ? 'rgba(255, 107, 43, 0.08)' : '#f9fafb',
            border: message.is_flagged_for_dma
              ? '1px solid rgba(255, 59, 59, 0.3)'
              : '1px solid #e5e7eb',
            borderLeft: message.is_flagged_for_dma ? '3px solid #FF3B3B' : isDMA ? '3px solid #FF6B2B' : '3px solid #d1d5db',
            borderRadius: '2px 8px 8px 8px',
          }}
        >
          <p className="font-body text-sm text-gray-800 leading-relaxed">
            {message.content}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="font-mono text-[10px] tracking-wider"
            style={{ color: isDMA ? '#FF6B2B' : '#FF6B2B' }}
          >
            {isDMA ? 'DMA · COMMAND' : `${message.sender_name?.toUpperCase() || 'UNKNOWN'} · ${message.sender_type.toUpperCase()}`}
          </span>
          <span className="font-mono text-[10px] text-gray-400">
            {formatTime(message.created_at)}
          </span>
          {message.is_flagged_for_dma && (
            <span className="font-mono text-[10px] text-red-500">⚑ FLAGGED FOR DMA</span>
          )}
        </div>
        {!isDMA && onFlag && (
          <button
            onClick={() => onFlag(message.id)}
            className="mt-1 font-mono text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          >
            ⚑ Flag
          </button>
        )}
      </div>
    </div>
  );
}
