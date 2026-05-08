import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: members, error } = await supabase
      .from('task_force_member')
      .select(`
        *,
        volunteer:volunteer(id, name, type, status, last_seen)
      `)
      .eq('task_force_id', id);

    if (error) {
      console.error('Error fetching TF members:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const volunteers = members?.map(m => ({
      id: m.volunteer.id,
      name: m.volunteer.name,
      type: m.volunteer.type,
      status: m.volunteer.status,
      last_seen: m.volunteer.last_seen,
      member_type: m.member_type,
      role: m.role
    })) || [];

    return NextResponse.json(volunteers);
  } catch (error) {
    console.error('Error in GET /api/dma/taskforce/[id]/members:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
