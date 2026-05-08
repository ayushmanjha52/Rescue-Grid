import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
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

    const { data: assignments, error } = await supabase
      .from('assignment')
      .select(`
        *,
        volunteer:assigned_to_volunteer(id, name, mobile_no, type),
        task_force:assigned_to_taskforce(id, name),
        victim_report:victim_report_id(id, situation, urgency, status)
      `)
      .eq('assigned_to_volunteer', volunteerId)
      .in('status', ['open', 'active', 'en_route', 'on_my_way', 'arrived', 'on-mission'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching queue:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const { data: tfAssignments } = await supabase
      .from('assignment')
      .select(`
        *,
        task_force:assigned_to_taskforce(id, name),
        victim_report:victim_report_id(id, situation, urgency, status)
      `)
      .not('assigned_to_taskforce', 'is', null)
      .in('status', ['open', 'active', 'en_route', 'on_my_way', 'arrived', 'on-mission'])
      .order('created_at', { ascending: false });

    const filteredTfAssignments = [];
    for (const a of tfAssignments || []) {
      const { data: members } = await supabase
        .from('task_force_member')
        .select('volunteer_id')
        .eq('task_force_id', a.assigned_to_taskforce);
      if (members?.some(m => m.volunteer_id === volunteerId)) {
        filteredTfAssignments.push(a);
      }
    }

    const allAssignments = [...(assignments || []), ...filteredTfAssignments];
    return NextResponse.json(allAssignments);
  } catch (error) {
    console.error('Error in GET /api/volunteer/assignment/queue:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
