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
    const sessionCookie = cookieStore.get('volunteer_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'offline'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('volunteer')
      .update({ status })
      .eq('id', volunteerId);

    if (error) {
      console.error('Error updating status:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/status:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
