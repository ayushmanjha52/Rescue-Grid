import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';

interface TaskForceRow {
  members: unknown[] | null;
  assignment: { task: string; status: string } | null;
  [key: string]: unknown;
}

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data: taskForces, error } = await supabase
      .from('task_force')
      .select(`
        *,
        members:task_force_member(
          id,
          volunteer_id,
          member_type,
          volunteer:volunteer_id(id, name, type, status)
        ),
        assignment:assignment_id(task, status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enrichedTaskForces = ((taskForces || []) as TaskForceRow[]).map((tf) => ({
      ...tf,
      member_count: tf.members?.length || 0,
      assignment_name: tf.assignment?.task || null,
      assignment_status: tf.assignment?.status || null,
    }));

    return NextResponse.json(enrichedTaskForces);
  } catch (err) {
    console.error('TaskForce list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
