import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';

interface MemberLocationRow {
  task_force_id: string;
  volunteer: {
    id: string;
    name: string;
    mobile_no: string;
    type: string | null;
    status: string;
    latitude: number | null;
    longitude: number | null;
    last_seen: string | null;
  } | null;
}

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();

    // Only members of active task forces matter for route drawing.
    const { data: members, error } = await supabase
      .from('task_force_member')
      .select(`
        task_force_id,
        task_force:task_force_id!inner(status),
        volunteer:volunteer_id(
          id, name, mobile_no, type, status, latitude, longitude, last_seen
        )
      `)
      .eq('task_force.status', 'active');

    if (error) throw error;

    const result = ((members || []) as unknown as MemberLocationRow[])
      .filter((m) => m.volunteer?.latitude != null && m.volunteer?.longitude != null)
      .map((m) => ({
        task_force_id: m.task_force_id,
        ...m.volunteer!,
      }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching TF member locations:', error);
    return NextResponse.json({ error: 'Failed to fetch member locations' }, { status: 500 });
  }
}
