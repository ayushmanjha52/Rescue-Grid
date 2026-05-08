import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('report_id');
    const supabase = createServiceClient();

    let query = supabase
      .from('assignment')
      .select(`
        *,
        volunteer:assigned_to_volunteer(id, name),
        task_force:assigned_to_taskforce(id, name),
        victim_report:victim_report_id(id, situation, city, district)
      `);

    if (reportId) {
      query = query.eq('victim_report_id', reportId);
    }

    const { data: assignments, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = (assignments || []).map((a: any) => {
      let assignee_name = "Unassigned";
      let assignee_type = "none";

      if (a.volunteer) {
        assignee_name = a.volunteer.name;
        assignee_type = "volunteer";
      } else if (a.task_force) {
        assignee_name = a.task_force.name;
        assignee_type = "taskforce";
      }

      return {
        ...a,
        volunteer_name: a.volunteer?.name || null,
        taskforce_name: a.task_force?.name || null,
        assignee_name,
        assignee_type,
        victim_situation: a.victim_report ? `${a.victim_report.situation} — ${a.victim_report.city}, ${a.victim_report.district}` : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('Assignment list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}