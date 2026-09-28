import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';

interface AssignmentRow {
  id: string;
  volunteer: { id: string; name: string; mobile_no: string | null } | null;
  task_force: { id: string; name: string } | null;
  victim_report: { id: string; situation: string; city: string | null; district: string | null } | null;
  [key: string]: unknown;
}

interface UpdateRow {
  assignment_id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Latest timeline entry per mission (empty if migration 017 isn't applied yet). */
async function latestUpdates(supabase: ServiceClient) {
  const { data, error } = await supabase
    .from('message')
    .select('assignment_id, content, sender_type, created_at')
    .not('assignment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3000);

  const latest: Record<string, Omit<UpdateRow, 'assignment_id'>> = {};
  if (error) return latest;
  for (const row of (data || []) as UpdateRow[]) {
    if (!latest[row.assignment_id]) {
      latest[row.assignment_id] = { content: row.content, sender_type: row.sender_type, created_at: row.created_at };
    }
  }
  return latest;
}

export async function GET(request: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const reportId = new URL(request.url).searchParams.get('report_id');
    const supabase = createServiceClient();

    let query = supabase
      .from('assignment')
      .select(`
        *,
        volunteer:assigned_to_volunteer(id, name, mobile_no),
        task_force:assigned_to_taskforce(id, name),
        victim_report:victim_report_id(id, situation, city, district)
      `);

    if (reportId) {
      query = query.eq('victim_report_id', reportId);
    }

    const [{ data: assignments, error }, updates] = await Promise.all([
      query.order('created_at', { ascending: false }).limit(1000),
      latestUpdates(supabase),
    ]);

    if (error) throw error;

    const enriched = ((assignments || []) as AssignmentRow[]).map((a) => {
      const place = [a.victim_report?.city, a.victim_report?.district].filter(Boolean).join(', ');
      return {
        ...a,
        volunteer_name: a.volunteer?.name || null,
        volunteer_phone: a.volunteer?.mobile_no || null,
        taskforce_name: a.task_force?.name || null,
        assignee_name: a.volunteer?.name || a.task_force?.name || 'Unassigned',
        assignee_type: a.volunteer ? 'volunteer' : a.task_force ? 'taskforce' : 'none',
        victim_situation: a.victim_report
          ? `${a.victim_report.situation}${place ? ` — ${place}` : ''}`
          : null,
        last_update: updates[a.id] ?? null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('Assignment list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
