import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isTaskForceMember, requireVolunteer } from '@/lib/auth/getVolunteer';
import { cleanMessageContent, MAX_MESSAGE_LENGTH, withSenderNames } from '@/lib/messages';

const MAX_HISTORY = 200;

export async function GET(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const taskforceId = new URL(request.url).searchParams.get('taskforce_id');
    if (!taskforceId) {
      return NextResponse.json({ error: 'taskforce_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    if (!(await isTaskForceMember(supabase, auth.volunteerId, taskforceId))) {
      return NextResponse.json({ error: 'You are not a member of this task force' }, { status: 403 });
    }

    // Newest N, returned oldest-first for display.
    const { data: messages, error } = await supabase
      .from('message')
      .select('*')
      .eq('task_force_id', taskforceId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY);

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(await withSenderNames(supabase, (messages || []).reverse()));
  } catch (error) {
    console.error('Error in GET /api/volunteer/message:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const body = await request.json().catch(() => ({}));
    const content = cleanMessageContent(body.content);
    const taskForceId = body.task_force_id;

    if (!content || !taskForceId) {
      return NextResponse.json(
        { error: `Message (max ${MAX_MESSAGE_LENGTH} chars) and task_force_id required` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    if (!(await isTaskForceMember(supabase, volunteerId, taskForceId))) {
      return NextResponse.json({ error: 'You are not a member of this task force' }, { status: 403 });
    }

    const { data: message, error } = await supabase
      .from('message')
      .insert({
        content,
        sender_type: 'volunteer',
        sender_id: volunteerId,
        task_force_id: taskForceId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const [withName] = await withSenderNames(supabase, [message]);
    return NextResponse.json(withName, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/volunteer/message:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
