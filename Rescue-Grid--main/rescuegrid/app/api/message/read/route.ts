import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channel_type, channel_id, current_user_id } = await request.json();

    if (!channel_type || !channel_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let filterColumn: string;
    if (channel_type === 'taskforce') {
      filterColumn = 'task_force_id';
    } else if (channel_type === 'victim_thread') {
      filterColumn = 'victim_report_id';
    } else {
      return NextResponse.json({ error: 'Invalid channel type' }, { status: 400 });
    }

    const { error } = await supabase
      .from('message')
      .update({ read_at: new Date().toISOString() })
      .eq(filterColumn, channel_id)
      .is('read_at', null)
      .neq('sender_id', current_user_id || '');

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/message/read:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
