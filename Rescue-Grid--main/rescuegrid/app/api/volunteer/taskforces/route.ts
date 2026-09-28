import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVolunteerTaskForceIds, requireVolunteer } from '@/lib/auth/getVolunteer';
import { withSenderNames } from '@/lib/messages';

/** Task forces the volunteer belongs to, with member counts and the latest message. */
export async function GET() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const taskForceIds = await getVolunteerTaskForceIds(supabase, auth.volunteerId);
    if (taskForceIds.length === 0) {
      return NextResponse.json([]);
    }

    const [{ data: taskForces }, { data: members }] = await Promise.all([
      supabase.from('task_force').select('id, name, status, assignment_id').in('id', taskForceIds),
      supabase.from('task_force_member').select('task_force_id').in('task_force_id', taskForceIds),
    ]);

    const memberCounts: Record<string, number> = {};
    for (const m of members || []) {
      memberCounts[m.task_force_id] = (memberCounts[m.task_force_id] || 0) + 1;
    }

    const result = await Promise.all(
      (taskForces || []).map(async (tf) => {
        const { data: last } = await supabase
          .from('message')
          .select('content, created_at, sender_type, sender_id')
          .eq('task_force_id', tf.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const [lastMessage] = last && last.length > 0 ? await withSenderNames(supabase, last) : [null];
        return { ...tf, member_count: memberCounts[tf.id] || 0, last_message: lastMessage };
      })
    );

    // Active groups first, then most recent activity.
    result.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
      const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/volunteer/taskforces:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
