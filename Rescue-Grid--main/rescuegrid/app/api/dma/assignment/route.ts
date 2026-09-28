import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { getAssignmentRecipients } from '@/lib/assignments';
import { sendPushToVolunteers } from '@/lib/push/sendPush';
import { notifyReportUpdated } from '@/lib/notify';
import { isUrgency } from '@/lib/status';

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

export async function POST(req: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const { urgency, latitude, longitude, assigned_to_volunteer, assigned_to_taskforce, victim_report_id } = body;
    const task = typeof body.task === 'string' ? body.task.trim() : '';
    const locationLabel = typeof body.location_label === 'string' ? body.location_label.trim() : '';

    if (!task || !locationLabel) {
      return NextResponse.json({ error: 'Task and location are required' }, { status: 400 });
    }
    if (!isUrgency(urgency)) {
      return NextResponse.json({ error: 'Urgency must be critical, urgent or moderate' }, { status: 400 });
    }
    if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) {
      return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    }

    const hasVolunteer = !!assigned_to_volunteer;
    const hasTaskForce = !!assigned_to_taskforce;

    if (hasVolunteer === hasTaskForce) {
      return NextResponse.json({ error: 'Assign to exactly one volunteer or one task force' }, { status: 400 });
    }

    let timer: string | null = null;
    if (body.timer) {
      const deadline = new Date(body.timer);
      if (Number.isNaN(deadline.getTime())) {
        return NextResponse.json({ error: 'Invalid deadline' }, { status: 400 });
      }
      timer = deadline.toISOString();
    }

    const supabase = createServiceClient();

    const { data: assignment, error } = await supabase
      .from('assignment')
      .insert({
        task: task.slice(0, 1000),
        urgency,
        location_label: locationLabel.slice(0, 300),
        latitude,
        longitude,
        status: 'active',
        timer,
        victim_report_id: victim_report_id || null,
        assigned_to_volunteer: assigned_to_volunteer || null,
        assigned_to_taskforce: assigned_to_taskforce || null,
      })
      .select()
      .single();

    if (error) throw error;

    await Promise.all([
      // Linked victim report now has a responder.
      victim_report_id
        ? supabase
            .from('victim_report')
            .update({ status: 'assigned', updated_at: new Date().toISOString() })
            .eq('id', victim_report_id)
            .in('status', ['open', 'verified'])
        : Promise.resolve(),
      // Keep the task force's current mission pointer in sync.
      assigned_to_taskforce
        ? supabase.from('task_force').update({ assignment_id: assignment.id }).eq('id', assigned_to_taskforce)
        : Promise.resolve(),
    ]);

    await notifyReportUpdated(victim_report_id);

    const recipients = await getAssignmentRecipients(supabase, assignment);
    await sendPushToVolunteers(
      supabase,
      recipients,
      '⚡ New Mission',
      `${urgency.toUpperCase()} · ${locationLabel}`,
      '/volunteer/missions'
    );

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    console.error('Assignment POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
