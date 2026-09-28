import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isTaskForceMember, requireVolunteer } from '@/lib/auth/getVolunteer';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('message')
      .select('id, task_force_id, sender_id, receiver_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Volunteers can only flag messages they can see.
    const canSee = existing.task_force_id
      ? await isTaskForceMember(supabase, volunteerId, existing.task_force_id)
      : existing.sender_id === volunteerId || existing.receiver_id === volunteerId;

    if (!canSee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: message, error } = await supabase
      .from('message')
      .update({ is_flagged_for_dma: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error flagging message:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/message/[id]/flag:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
