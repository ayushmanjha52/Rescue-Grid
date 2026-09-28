'use client';

import { useCallback, useEffect, useState } from 'react';

export type PushState = 'unsupported' | 'unconfigured' | 'default' | 'denied' | 'subscribed' | 'loading';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Registers the service worker and manages the volunteer's web-push subscription. */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isSupported()) {
        if (!cancelled) setState('unsupported');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;
        if (!VAPID_PUBLIC_KEY) {
          setState('unconfigured');
          return;
        }
        if (Notification.permission === 'denied') {
          setState('denied');
          return;
        }
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (subscription) {
          // Re-sync in case the server forgot it (e.g. after it expired once).
          await fetch('/api/volunteer/push-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription }),
          });
          setState('subscribed');
        } else {
          setState('default');
        }
      } catch {
        if (!cancelled) setState('unsupported');
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!isSupported() || !VAPID_PUBLIC_KEY) return;
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const res = await fetch('/api/volunteer/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
      if (!res.ok) throw new Error('Could not save subscription');
      setState('subscribed');
    } catch {
      setError('Could not enable notifications on this device.');
    }
  }, []);

  const disable = useCallback(async () => {
    if (!isSupported()) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await fetch('/api/volunteer/push-token', { method: 'DELETE' });
      setState('default');
    } catch {
      setError('Could not turn off notifications.');
    }
  }, []);

  return { state, error, enable, disable };
}
