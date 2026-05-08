import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

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
