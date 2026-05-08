import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPush } from '@/lib/push/sendPush';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task, urgency, location_label, latitude, longitude, assigned_to_volunteer, assigned_to_taskforce, timer, victim_report_id } = body;

    if (!task || !urgency || !location_label || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Missing required fields: task, urgency, location_label, latitude, longitude' }, { status: 400 });
    }

    const hasVolunteer = !!assigned_to_volunteer;
    const hasTaskForce = !!assigned_to_taskforce;

    if (!hasVolunteer && !hasTaskForce) {
      return NextResponse.json({ error: 'Must assign to either a volunteer or a task force' }, { status: 400 });
    }

    if (hasVolunteer && hasTaskForce) {
      return NextResponse.json({ error: 'Cannot assign to both volunteer and task force simultaneously' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const insertData: Record<string, unknown> = {
      task,
      urgency,
      location_label,
      latitude,
      longitude,
      status: 'active',
      timer: timer || null,
      victim_report_id: victim_report_id || null,
      assigned_to_volunteer: assigned_to_volunteer || null,
      assigned_to_taskforce: assigned_to_taskforce || null,
    };

    const { data: assignment, error } = await supabase
      .from('assignment')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Update linked victim report status to 'assigned'
    if (victim_report_id) {
      await supabase
        .from('victim_report')
        .update({ status: 'assigned' })
        .eq('id', victim_report_id);
    }

    if (assigned_to_volunteer) {
      const { data: vol } = await supabase
        .from('volunteer')
        .select('push_token')
        .eq('id', assigned_to_volunteer)
        .single();

      if (vol?.push_token) {
        await sendPush(vol.push_token, '⚡ New Mission', `${urgency} · ${location_label}`);
      }
    } else if (assigned_to_taskforce) {
      const { data: members } = await supabase
        .from('task_force_member')
        .select('volunteer_id')
        .eq('task_force_id', assigned_to_taskforce);

      if (members) {
        const volunteerIds = members.map((m: { volunteer_id: string }) => m.volunteer_id);
        const { data: volunteers } = await supabase
          .from('volunteer')
          .select('push_token')
          .in('id', volunteerIds);

        if (volunteers) {
          for (const v of volunteers) {
            if (v.push_token) {
              await sendPush(v.push_token, '⚡ New Mission', `${urgency} · ${location_label}`);
            }
          }
        }
      }
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    console.error('Assignment POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}