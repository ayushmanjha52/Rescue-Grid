import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

interface TaskForce {
  id: string;
  name: string;
  status: string;
}

interface TaskForceMember {
  task_force_id: string;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('volunteer_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const volunteerId = session.volunteer_id;

    const { data: memberships, error } = await supabase
      .from('task_force_member')
      .select('task_force_id')
      .eq('volunteer_id', volunteerId);

    if (error) {
      console.error('Error fetching task forces:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json([]);
    }

    const taskForceIds = memberships.map((m: TaskForceMember) => m.task_force_id);
    const { data: taskForces } = await supabase
      .from('task_force')
      .select('id, name, status')
      .in('id', taskForceIds);

    return NextResponse.json(taskForces || []);
  } catch (error) {
    console.error('Error in GET /api/volunteer/taskforces:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
