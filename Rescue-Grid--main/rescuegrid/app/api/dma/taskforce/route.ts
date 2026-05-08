import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, member_ids, assignment_id } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Task force name is required' }, { status: 400 });
    }

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: 'At least one member is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: taskForce, error: tfError } = await supabase
      .from('task_force')
      .insert({
        name: name.trim(),
        status: 'active',
        assignment_id: assignment_id || null,
      })
      .select()
      .single();

    if (tfError) throw tfError;

    const memberInserts = member_ids.map((volunteer_id: string) => ({
      task_force_id: taskForce.id,
      volunteer_id,
    }));

    const { error: memberError } = await supabase
      .from('task_force_member')
      .insert(memberInserts);

    if (memberError) throw memberError;

    const { data: members } = await supabase
      .from('task_force_member')
      .select('volunteer_id')
      .eq('task_force_id', taskForce.id);

    return NextResponse.json({ ...taskForce, members: members || [] }, { status: 201 });
  } catch (err) {
    console.error('TaskForce POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
