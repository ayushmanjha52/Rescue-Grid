'use client';

import { useState, useRef, useEffect, useCallback, ReactNode, RefObject } from 'react';

const NEAR_BOTTOM_PX = 100;

export interface ChatScrollController {
  containerRef: RefObject<HTMLDivElement | null>;
  isNearBottom: boolean;
  newMessagesCount: number;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleScroll: () => void;
  notifyNewMessage: () => void;
  resetNewMessagesCount: () => void;
}

/**
 * Scroll state for a chat pane: keeps the view pinned to the newest message
 * while the reader is at the bottom, and counts unseen messages otherwise.
 */
export function useChatScroll(): ChatScrollController {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessagesCount(0);
  }, []);

  const notifyNewMessage = useCallback(() => {
    if (isNearBottomRef.current) {
      // Wait for the new message to render before scrolling.
      requestAnimationFrame(() => scrollToBottom('smooth'));
    } else {
      setNewMessagesCount((prev) => prev + 1);
    }
  }, [scrollToBottom]);

  const resetNewMessagesCount = useCallback(() => setNewMessagesCount(0), []);

  return {
    containerRef,
    isNearBottom,
    newMessagesCount,
    scrollToBottom,
    handleScroll,
    notifyNewMessage,
    resetNewMessagesCount,
  };
}

interface ChatScrollAreaProps {
  header: ReactNode;
  children: ReactNode;
  inputArea: ReactNode;
  footerArea?: ReactNode;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  showJumpToBottom?: boolean;
  autoScrollOnMount?: boolean;
  className?: string;
  /** Pass a controller from useChatScroll() to drive scrolling from the parent. */
  scroll?: ChatScrollController;
}

export default function ChatScrollArea({
  header,
  children,
  inputArea,
  footerArea,
  isLoading = false,
  loadingComponent,
  showJumpToBottom = true,
  autoScrollOnMount = true,
  className = '',
  scroll,
}: ChatScrollAreaProps) {
  const internal = useChatScroll();
  const controller = scroll ?? internal;
  const { containerRef, isNearBottom, newMessagesCount, scrollToBottom, handleScroll, resetNewMessagesCount } = controller;

  useEffect(() => {
    if (autoScrollOnMount && !isLoading) {
      const id = setTimeout(() => scrollToBottom('instant'), 100);
      return () => clearTimeout(id);
    }
  }, [isLoading, autoScrollOnMount, scrollToBottom]);

  const defaultLoading = (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] text-gray-500">LOADING...</span>
      </div>
    </div>
  );

  return (
    <div
      className={`relative flex flex-col bg-white ${className}`}
      style={{ height: '100dvh', overflow: 'hidden' }}
    >
      <div className="flex-shrink-0">
        {header}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        {isLoading ? (loadingComponent || defaultLoading) : children}
      </div>

      {showJumpToBottom && !isNearBottom && newMessagesCount > 0 && (
        <button
          onClick={() => {
            scrollToBottom('smooth');
            resetNewMessagesCount();
          }}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-orange text-white px-4 py-2 rounded-full font-mono text-[11px] font-bold shadow-lg flex items-center gap-2 z-10"
        >
          ↓ {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''}
        </button>
      )}

      <div className="flex-shrink-0">
        {inputArea}
      </div>

      {footerArea && (
        <div className="flex-shrink-0">
          {footerArea}
        </div>
      )}
    </div>
  );
}
