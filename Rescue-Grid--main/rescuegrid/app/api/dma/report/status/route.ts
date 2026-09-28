import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { notifyReportUpdated } from '@/lib/notify';
import { isReportStatus, isUrgency, REPORT_STATUSES, URGENCIES } from '@/lib/status';

/** Updates a victim report's status and/or triage urgency. */
export async function PATCH(req: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { report_id, status, urgency } = await req.json().catch(() => ({}));

    if (!report_id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const updates: Record<string, string> = { updated_at: new Date().toISOString() };

    if (status !== undefined) {
      if (!isReportStatus(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${REPORT_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (urgency !== undefined) {
      if (!isUrgency(urgency)) {
        return NextResponse.json(
          { error: `Invalid urgency. Must be one of: ${URGENCIES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.urgency = urgency;
    }

    if (!updates.status && !updates.urgency) {
      return NextResponse.json({ error: 'Provide a status or urgency to update' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: report, error: reportError } = await supabase
      .from('victim_report')
      .update(updates)
      .eq('id', report_id)
      .select()
      .maybeSingle();

    if (reportError) {
      console.error('Update report status error:', reportError);
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await notifyReportUpdated(report.id);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error('Update status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
