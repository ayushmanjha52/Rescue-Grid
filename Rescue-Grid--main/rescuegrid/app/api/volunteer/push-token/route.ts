import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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
    const { subscription } = body;

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('volunteer')
      .update({ push_token: JSON.stringify(subscription) })
      .eq('id', volunteerId);

    if (error) {
      console.error('Error saving push token:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/volunteer/push-token:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
