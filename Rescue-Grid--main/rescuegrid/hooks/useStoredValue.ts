'use client';

import { useCallback, useSyncExternalStore } from 'react';

type StorageKind = 'local' | 'session';

const listeners = new Set<() => void>();

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Private mode / blocked storage
    return null;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Reads a string from web storage and re-renders when it changes (in this tab
 * via the setter, or in other tabs via the `storage` event). Returns null during
 * SSR so server and client markup match.
 */
export function useStoredValue(key: string, kind: StorageKind = 'local') {
  const value = useSyncExternalStore(
    subscribe,
    () => getStorage(kind)?.getItem(key) ?? null,
    () => null
  );

  const setValue = useCallback(
    (next: string | null) => {
      const storage = getStorage(kind);
      if (!storage) return;
      if (next === null) storage.removeItem(key);
      else storage.setItem(key, next);
      listeners.forEach((listener) => listener());
    },
    [key, kind]
  );

  return [value, setValue] as const;
}

/** Imperative helpers for event handlers. */
export function writeStoredValue(key: string, value: string | null, kind: StorageKind = 'local') {
  if (typeof window === 'undefined') return;
  const storage = getStorage(kind);
  if (!storage) return;
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
  listeners.forEach((listener) => listener());
}

export function readStoredValue(key: string, kind: StorageKind = 'local'): string | null {
  if (typeof window === 'undefined') return null;
  return getStorage(kind)?.getItem(key) ?? null;
}
