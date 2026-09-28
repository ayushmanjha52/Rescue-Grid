'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

/** Calls `onEscape` when the Escape key is pressed (e.g. to close a dialog). */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const handlerRef = useRef(onEscape);
  useLayoutEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlerRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
