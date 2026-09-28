import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';

interface MemberRow {
  member_type: string | null;
  role: string | null;
  volunteer: { id: string; name: string; mobile_no: string; type: string | null; status: string } | null;
}

/** GET /api/dma/taskforce/members?taskforce_id=… — roster with contact numbers. */
export async function GET(request: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const taskforceId = new URL(request.url).searchParams.get('taskforce_id');

    if (!taskforceId) {
      return NextResponse.json({ error: 'taskforce_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: members, error } = await supabase
      .from('task_force_member')
      .select('member_type, role, volunteer:volunteer_id(id, name, mobile_no, type, status)')
      .eq('task_force_id', taskforceId);

    if (error) throw error;

    const result = ((members || []) as unknown as MemberRow[])
      .filter((m) => m.volunteer)
      .map((m) => ({
        ...m.volunteer!,
        member_type: m.member_type,
        role: m.role,
      }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching TF members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
