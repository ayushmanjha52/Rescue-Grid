import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !['completed', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'Status must be completed or failed' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    const { data: assignment, error } = await supabase
      .from('assignment')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (status === 'completed' && assignment.victim_report_id) {
      await supabase
        .from('victim_report')
        .update({ status: 'resolved' })
        .eq('id', assignment.victim_report_id);
    }

    return NextResponse.json(assignment);
  } catch (err) {
    console.error('Assignment PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}