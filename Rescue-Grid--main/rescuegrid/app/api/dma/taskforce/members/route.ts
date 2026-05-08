import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

interface TaskForceMember {
  volunteer_id: string;
  member_type: string | null;
  role: string | null;
}

interface Volunteer {
  id: string;
  name: string;
  mobile_no: string;
  type: string | null;
  status: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskforceId = searchParams.get('taskforce_id');

    if (!taskforceId) {
      return NextResponse.json({ error: 'taskforce_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: members, error } = await supabase
      .from('task_force_member')
      .select('volunteer_id, member_type, role')
      .eq('task_force_id', taskforceId);

    if (error) throw error;
    if (!members || members.length === 0) {
      return NextResponse.json([]);
    }

    const volunteerIds = members.map(m => m.volunteer_id);
    const { data: volunteersData } = await supabase
      .from('volunteer')
      .select('id, name, mobile_no, type, status')
      .in('id', volunteerIds);

    const volunteerMap = new Map<string, Volunteer>();
    volunteersData?.forEach(v => volunteerMap.set(v.id, v));

    const result = members.map((m: TaskForceMember) => {
      const volunteer = volunteerMap.get(m.volunteer_id);
      return {
        id: volunteer?.id,
        name: volunteer?.name,
        mobile_no: volunteer?.mobile_no,
        type: volunteer?.type,
        status: volunteer?.status,
        member_type: m.member_type,
        role: m.role
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching TF members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
