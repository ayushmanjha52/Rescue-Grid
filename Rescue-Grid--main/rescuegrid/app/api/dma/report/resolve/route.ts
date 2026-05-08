import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_id } = body;

    if (!report_id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    
    // Update victim report status to 'resolved'
    const { error: reportError } = await supabase
      .from('victim_report')
      .update({ status: 'resolved' })
      .eq('id', report_id);
    
    if (reportError) throw reportError;
    
    // Also mark all active assignments for this report as 'completed'
    const { error: assignmentError } = await supabase
      .from('assignment')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('victim_report_id', report_id)
      .in('status', ['open', 'active', 'en_route', 'on_my_way', 'arrived', 'on-mission']);

    if (assignmentError) throw assignmentError;
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Resolve report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}