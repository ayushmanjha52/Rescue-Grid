import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';

interface MemberRow {
  member_type: string | null;
  role: string | null;
  volunteer: { id: string; name: string; type: string | null; status: string; last_seen: string | null; mobile_no: string } | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: members, error } = await supabase
      .from('task_force_member')
      .select('member_type, role, volunteer:volunteer_id(id, name, type, status, last_seen, mobile_no)')
      .eq('task_force_id', id);

    if (error) {
      console.error('Error fetching TF members:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Skip memberships whose volunteer was deleted instead of crashing on them.
    const volunteers = ((members || []) as unknown as MemberRow[])
      .filter((m) => m.volunteer)
      .map((m) => ({
        ...m.volunteer!,
        member_type: m.member_type,
        role: m.role,
      }));

    return NextResponse.json(volunteers);
  } catch (error) {
    console.error('Error in GET /api/dma/taskforce/[id]/members:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
