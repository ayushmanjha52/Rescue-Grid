import webpush from 'web-push';

let initialized = false;

function ensureInitialized() {
  if (!initialized && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@rescuegrid.in',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    initialized = true;
  }
}

export async function sendPush(pushToken: string, title: string, body: string) {
  if (!pushToken) return;
  try {
    ensureInitialized();
    if (!initialized) {
      console.warn('Push notifications not configured (VAPID keys missing)');
      return;
    }
    const subscription = typeof pushToken === 'string' ? JSON.parse(pushToken) : pushToken;
    await webpush.sendNotification(
      subscription as any,
      JSON.stringify({ title, body }),
      { TTL: 86400 }
    );
  } catch (err) {
    console.error('Push failed:', err);
  }
}