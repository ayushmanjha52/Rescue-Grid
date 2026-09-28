import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isTaskForceMember, requireVolunteer } from '@/lib/auth/getVolunteer';

/** Task force details + roster, visible only to its members. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const { id } = await params;
    const supabase = createServiceClient();

    if (!(await isTaskForceMember(supabase, auth.volunteerId, id))) {
      return NextResponse.json({ error: 'You are not a member of this task force' }, { status: 403 });
    }

    const [{ data: taskForce }, { data: members, error }] = await Promise.all([
      supabase.from('task_force').select('id, name, status, assignment_id').eq('id', id).maybeSingle(),
      supabase
        .from('task_force_member')
        .select('member_type, role, volunteer:volunteer_id(id, name, type, status, last_seen, mobile_no)')
        .eq('task_force_id', id),
    ]);

    if (error) throw error;
    if (!taskForce) {
      return NextResponse.json({ error: 'Task force not found' }, { status: 404 });
    }

    type MemberRow = {
      member_type: string | null;
      role: string | null;
      volunteer: { id: string; name: string; type: string | null; status: string; last_seen: string | null; mobile_no: string } | null;
    };

    const roster = ((members || []) as unknown as MemberRow[])
      .filter((m) => m.volunteer)
      .map((m) => ({
        ...m.volunteer!,
        member_type: m.member_type,
        role: m.role,
      }));

    return NextResponse.json({ ...taskForce, members: roster });
  } catch (error) {
    console.error('Error in GET /api/volunteer/taskforces/[id]:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
