import webpush, { type PushSubscription } from 'web-push';
import type { createServiceClient } from '@/lib/supabase/service';

let initialized = false;

function ensureInitialized() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_KEY;
  if (!initialized && publicKey && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@rescuegrid.in',
      publicKey,
      process.env.VAPID_PRIVATE_KEY
    );
    initialized = true;
  }
}

/**
 * Sends a web-push notification. Returns false when the subscription is gone
 * (404/410) so callers can forget the stale token.
 */
export async function sendPush(pushToken: string, title: string, body: string, url?: string): Promise<boolean> {
  if (!pushToken) return true;
  try {
    ensureInitialized();
    if (!initialized) {
      console.warn('Push notifications not configured (VAPID keys missing)');
      return true;
    }
    const subscription = JSON.parse(pushToken) as PushSubscription;
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url }),
      { TTL: 86400 }
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return false;
    console.error('Push failed:', err);
    return true;
  }
}

/** Sends a push to many volunteers in parallel and clears expired subscriptions. */
export async function sendPushToVolunteers(
  supabase: ReturnType<typeof createServiceClient>,
  volunteerIds: string[],
  title: string,
  body: string,
  url?: string
) {
  if (volunteerIds.length === 0) return;

  const { data: volunteers } = await supabase
    .from('volunteer')
    .select('id, push_token')
    .in('id', volunteerIds)
    .not('push_token', 'is', null);

  await Promise.allSettled(
    (volunteers || []).map(async (v: { id: string; push_token: string | null }) => {
      const alive = await sendPush(v.push_token as string, title, body, url);
      if (!alive) {
        await supabase.from('volunteer').update({ push_token: null }).eq('id', v.id);
      }
    })
  );
}
