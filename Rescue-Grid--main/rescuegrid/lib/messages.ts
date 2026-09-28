import type { createServiceClient } from '@/lib/supabase/service';

type ServiceClient = ReturnType<typeof createServiceClient>;

export const MAX_MESSAGE_LENGTH = 2000;

interface MessageRow {
  sender_type: string;
  sender_id: string | null;
  [key: string]: unknown;
}

/**
 * Adds a human readable `sender_name` to each message. `message.sender_id` has
 * no foreign key (DMA and victims have no volunteer row), so names are resolved
 * with a separate lookup instead of a PostgREST embed.
 */
export async function withSenderNames<T extends MessageRow>(
  supabase: ServiceClient,
  messages: T[],
  victimLabel = 'Victim'
): Promise<(T & { sender_name: string })[]> {
  const volunteerIds = [
    ...new Set(
      messages
        .filter((m) => m.sender_type === 'volunteer' && m.sender_id)
        .map((m) => m.sender_id as string)
    ),
  ];

  const names: Record<string, string> = {};
  if (volunteerIds.length > 0) {
    const { data } = await supabase.from('volunteer').select('id, name').in('id', volunteerIds);
    for (const v of data || []) names[v.id] = v.name;
  }

  return messages.map((m) => ({
    ...m,
    sender_name:
      m.sender_type === 'dma'
        ? 'DMA Command'
        : m.sender_type === 'victim'
          ? victimLabel
          : names[m.sender_id || ''] || 'Volunteer',
  }));
}

/** Trims message content and enforces the max length. Returns null if invalid. */
export function cleanMessageContent(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}
