'use client';

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';

interface ChatScrollAreaProps {
  header: ReactNode;
  children: ReactNode;
  inputArea: ReactNode;
  footerArea?: ReactNode;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyComponent?: ReactNode;
  showJumpToBottom?: boolean;
  autoScrollOnMount?: boolean;
  className?: string;
}

export default function ChatScrollArea({
  header,
  children,
  inputArea,
  footerArea,
  isLoading = false,
  loadingComponent,
  emptyComponent,
  showJumpToBottom = true,
  autoScrollOnMount = true,
  className = '',
}: ChatScrollAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom < 100);
    if (distanceFromBottom < 100) {
      setNewMessagesCount(0);
    }
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = window.visualViewport?.height ?? window.innerHeight;
        setContainerHeight(height);
        containerRef.current.style.height = `${height}px`;
      }
    };

    updateHeight();
    window.visualViewport?.addEventListener('resize', updateHeight);
    window.addEventListener('resize', updateHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    if (autoScrollOnMount && !isLoading) {
      setTimeout(() => scrollToBottom('instant'), 100);
    }
  }, [isLoading, autoScrollOnMount, scrollToBottom]);

  const defaultLoading = (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] text-gray-400">LOADING...</span>
      </div>
    </div>
  );

  const defaultEmpty = (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="font-display text-[14px] text-gray-700 mb-1">NO MESSAGES</p>
        <p className="font-mono text-[10px] text-gray-400">Start the conversation</p>
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col bg-white ${className}`}
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
        {isLoading ? (
          loadingComponent || defaultLoading
        ) : (
          <>
            {children}
            <div ref={messagesEndRef} style={{ height: 1 }} />
          </>
        )}
      </div>

      {showJumpToBottom && !isNearBottom && newMessagesCount > 0 && (
        <button
          onClick={() => {
            scrollToBottom('smooth');
            setNewMessagesCount(0);
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

export function useChatScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom < 100);
    if (distanceFromBottom < 100) {
      setNewMessagesCount(0);
    }
  }, []);

  const notifyNewMessage = useCallback(() => {
    if (!isNearBottom) {
      setNewMessagesCount(prev => prev + 1);
    } else {
      scrollToBottom('smooth');
    }
  }, [isNearBottom, scrollToBottom]);

  const resetNewMessagesCount = useCallback(() => {
    setNewMessagesCount(0);
  }, []);

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
