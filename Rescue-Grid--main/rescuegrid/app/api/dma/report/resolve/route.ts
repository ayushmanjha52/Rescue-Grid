import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { syncVolunteerMissionStatus, getAssignmentRecipients } from '@/lib/assignments';
import { ASSIGNMENT_PENDING } from '@/lib/status';
import { notifyReportUpdated } from '@/lib/notify';

/** Resolves a victim report and closes every mission still open for it. */
export async function POST(req: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { report_id } = await req.json().catch(() => ({}));

    if (!report_id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: report, error: reportError } = await supabase
      .from('victim_report')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', report_id)
      .select('id')
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const { data: closed, error: assignmentError } = await supabase
      .from('assignment')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('victim_report_id', report_id)
      .in('status', ASSIGNMENT_PENDING as unknown as string[])
      .select('assigned_to_volunteer, assigned_to_taskforce');

    if (assignmentError) throw assignmentError;

    // Responders on those missions are free again.
    const volunteerIds = new Set<string>();
    for (const assignment of closed || []) {
      for (const id of await getAssignmentRecipients(supabase, assignment)) volunteerIds.add(id);
    }
    await syncVolunteerMissionStatus(supabase, [...volunteerIds]);
    await notifyReportUpdated(report_id);

    return NextResponse.json({ success: true, closed_assignments: closed?.length || 0 });
  } catch (err) {
    console.error('Resolve report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
