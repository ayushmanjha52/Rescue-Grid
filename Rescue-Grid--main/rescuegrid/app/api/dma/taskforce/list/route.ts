import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    const { data: taskForces, error } = await supabase
      .from('task_force')
      .select(`
        *,
        members:task_force_member(
          id, 
          volunteer_id, 
          volunteer:volunteer_id(id, name, type, status)
        ),
        assignment:assignment_id(task)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enrichedTaskForces = (taskForces || []).map((tf: any) => ({
      ...tf,
      member_count: tf.members?.length || 0,
      assignment_name: tf.assignment?.task || null,
    }));

    return NextResponse.json(enrichedTaskForces);
  } catch (err) {
    console.error('TaskForce list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
