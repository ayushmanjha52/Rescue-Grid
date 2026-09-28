import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { cleanMessageContent, MAX_MESSAGE_LENGTH } from '@/lib/messages';

// Direct channel between a volunteer and DMA Command:
//   DMA → volunteer: sender_type 'dma', receiver_id = volunteer
//   volunteer → DMA: sender_type 'volunteer', sender_id = volunteer, receiver_id null

export async function GET() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();
    const { data: messages, error } = await supabase
      .from('message')
      .select('*')
      .or(`receiver_id.eq.${volunteerId},sender_id.eq.${volunteerId}`)
      .is('task_force_id', null)
      .is('victim_report_id', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Oldest-first for display.
    return NextResponse.json((messages || []).reverse());
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const content = cleanMessageContent(body.content);
    if (!content) {
      return NextResponse.json({ error: `Message required (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: message, error } = await supabase
      .from('message')
      .insert({
        content,
        sender_type: 'volunteer',
        sender_id: auth.volunteerId,
        receiver_id: null, // always addressed to DMA Command
        task_force_id: null,
        victim_report_id: null,
        is_flagged_for_dma: body.flag === true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error sending direct message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

/** Marks every unread DMA → volunteer message as read. */
export async function PATCH() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('message')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', auth.volunteerId)
      .eq('sender_type', 'dma')
      .is('read_at', null);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking direct messages read:', error);
    return NextResponse.json({ error: 'Failed to mark messages read' }, { status: 500 });
  }
}
