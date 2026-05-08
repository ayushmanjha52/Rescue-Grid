import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('volunteer_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;
    const { searchParams } = new URL(request.url);
    const taskforceId = searchParams.get('taskforce_id');

    if (!taskforceId) {
      return NextResponse.json({ error: 'taskforce_id required' }, { status: 400 });
    }

    const { data: messages, error } = await supabase
      .from('message')
      .select(`
        *,
        sender:volunteer(id, name, type)
      `)
      .eq('task_force_id', taskforceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(messages || []);
  } catch (error) {
    console.error('Error in GET /api/volunteer/message:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('volunteer_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;
    const body = await request.json();
    const { content, task_force_id } = body;

    if (!content || !task_force_id) {
      return NextResponse.json({ error: 'Content and task_force_id required' }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from('message')
      .insert({
        content,
        sender_type: 'volunteer',
        sender_id: volunteerId,
        task_force_id
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/volunteer/message:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
