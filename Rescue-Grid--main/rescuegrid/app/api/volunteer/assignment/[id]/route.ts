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

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;
    const { id } = await params;
    const body = await request.json();
    const { status: statusFromBody, action } = body;
    const status = statusFromBody || action;

    if (!status || !['active', 'en_route', 'on_my_way', 'arrived', 'completed', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data: assignment, error: fetchError } = await supabase
      .from('assignment')
      .select('assigned_to_volunteer, assigned_to_taskforce, victim_report_id')
      .eq('id', id)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    let isAuthorized = assignment.assigned_to_volunteer === volunteerId;
    
    if (!isAuthorized && assignment.assigned_to_taskforce) {
      const { data: members } = await supabase
        .from('task_force_member')
        .select('volunteer_id')
        .eq('task_force_id', assignment.assigned_to_taskforce)
        .eq('volunteer_id', volunteerId);
      
      isAuthorized = (members?.length || 0) > 0;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { 
      status,
      updated_at: new Date().toISOString()
    };

    if (assignment.victim_report_id) {
      let victimStatus = 'assigned';
      if (status === 'completed') victimStatus = 'resolved';
      else if (status === 'en_route' || status === 'on_my_way') victimStatus = 'en_route';
      else if (status === 'arrived') victimStatus = 'arrived';
      else if (status === 'active') victimStatus = 'active';
      
      await supabase
        .from('victim_report')
        .update({ status: victimStatus })
        .eq('id', assignment.victim_report_id);
    }

    const { data, error } = await supabase
      .from('assignment')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating assignment:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/assignment/[id]:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
