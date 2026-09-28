'use client';

import { useSyncExternalStore } from 'react';

// One shared ticker per interval so many countdowns don't each start a timer.
const tickers = new Map<number, { listeners: Set<() => void>; id: ReturnType<typeof setInterval> | null; now: number }>();

function getTicker(intervalMs: number) {
  let ticker = tickers.get(intervalMs);
  if (!ticker) {
    ticker = { listeners: new Set(), id: null, now: Date.now() };
    tickers.set(intervalMs, ticker);
  }
  return ticker;
}

// useSyncExternalStore re-subscribes whenever `subscribe` changes identity, so
// each interval gets ONE subscribe function for the lifetime of the page. (An
// inline function re-subscribed on every render; with a single listener that
// restarted the ticker, changed `now`, re-rendered, and looped forever.)
const subscribers = new Map<number, (callback: () => void) => () => void>();

function getSubscribe(intervalMs: number) {
  let subscribe = subscribers.get(intervalMs);
  if (!subscribe) {
    subscribe = (callback: () => void) => {
      const ticker = getTicker(intervalMs);
      ticker.listeners.add(callback);
      if (ticker.id === null) {
        ticker.now = Date.now();
        ticker.id = setInterval(() => {
          ticker.now = Date.now();
          ticker.listeners.forEach((listener) => listener());
        }, intervalMs);
      }
      return () => {
        ticker.listeners.delete(callback);
        if (ticker.listeners.size === 0 && ticker.id !== null) {
          clearInterval(ticker.id);
          ticker.id = null;
        }
      };
    };
    subscribers.set(intervalMs, subscribe);
  }
  return subscribe;
}

const serverSnapshot = () => 0;

/**
 * Current time in ms, refreshed every `intervalMs`. Lets countdowns tick
 * without calling Date.now() during render. Returns 0 during SSR.
 */
export function useNow(intervalMs = 1000): number {
  return useSyncExternalStore(getSubscribe(intervalMs), () => getTicker(intervalMs).now, serverSnapshot);
}

/** "HH:MM:SS" until `deadline`, "00:00:00" once passed, null without a deadline. */
export function formatCountdown(deadline: string | null | undefined, now: number): string | null {
  if (!deadline || !now) return null;
  const diff = new Date(deadline).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "5m ago" style relative time. */
export function formatRelative(date: string | null | undefined, now: number): string {
  if (!date || !now) return '';
  const mins = Math.floor((now - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
