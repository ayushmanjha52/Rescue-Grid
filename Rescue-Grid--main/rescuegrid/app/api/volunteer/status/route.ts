import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { syncVolunteerMissionStatus } from '@/lib/assignments';

export async function PATCH(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();
    const { status } = await request.json().catch(() => ({}));

    if (!status || !['active', 'offline'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('volunteer')
      .update({ status, last_seen: new Date().toISOString() })
      .eq('id', volunteerId);

    if (error) {
      console.error('Error updating status:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Coming back online while a mission is in progress → on-mission.
    if (status === 'active') {
      await syncVolunteerMissionStatus(supabase, [volunteerId]);
    }

    const { data } = await supabase.from('volunteer').select('status').eq('id', volunteerId).single();
    return NextResponse.json({ success: true, status: data?.status ?? status });
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/status:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
