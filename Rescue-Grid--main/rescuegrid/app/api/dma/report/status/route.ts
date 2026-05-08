import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const VALID_STATUSES = ['open', 'verified', 'assigned', 'en_route', 'arrived', 'resolved', 'duplicate'];

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_id, status } = body;

    if (!report_id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const supabase = createServiceClient();
    
    // Update victim report status
    const { data: report, error: reportError } = await supabase
      .from('victim_report')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', report_id)
      .select()
      .single();
    
    if (reportError) {
      console.error('Update report status error:', reportError);
      return NextResponse.json({ error: 'Failed to update report status' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error('Update status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
