import { createServiceClient } from '@/lib/supabase/service';
import { REPORT_UPDATED_EVENT, reportTopic } from '@/lib/realtimeTopics';

/**
 * Tells an open victim status page that its report or thread changed.
 *
 * Victims have no account, so they can't read the tables through Realtime.
 * Instead the server sends a content-free "updated" ping on a broadcast topic
 * named after the report's UUID, and the page refetches through the API.
 * Best-effort: failures only delay the update until the page's next poll.
 */
export async function notifyReportUpdated(reportId: string | null | undefined) {
  if (!reportId) return;
  const supabase = createServiceClient();
  const channel = supabase.channel(reportTopic(reportId));
  try {
    await channel.httpSend(REPORT_UPDATED_EVENT, { at: new Date().toISOString() });
  } catch (err) {
    console.warn('Report update broadcast failed:', err);
  } finally {
    await supabase.removeChannel(channel);
  }
}
