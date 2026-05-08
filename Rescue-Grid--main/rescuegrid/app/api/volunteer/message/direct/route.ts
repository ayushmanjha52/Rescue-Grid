import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('volunteer_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;
    
    const supabase = createServiceClient();

    const { data: messages, error } = await supabase
      .from('message')
      .select('*')
      .or(`receiver_id.eq.${volunteerId},sender_id.eq.${volunteerId}`)
      .is('task_force_id', null)
      .is('victim_report_id', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(messages || []);
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('volunteer_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;
    
    const body = await request.json();
    const { content, receiver_id } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: message, error } = await supabase
      .from('message')
      .insert({
        content,
        sender_type: 'volunteer',
        sender_id: volunteerId,
        receiver_id: receiver_id || null,
        task_force_id: null,
        victim_report_id: null,
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
