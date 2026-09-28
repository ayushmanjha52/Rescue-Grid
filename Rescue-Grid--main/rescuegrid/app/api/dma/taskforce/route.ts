import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { sendPushToVolunteers } from '@/lib/push/sendPush';

export async function POST(req: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const { member_ids, assignment_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Task force name is required' }, { status: 400 });
    }

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: 'At least one member is required' }, { status: 400 });
    }

    const memberIds = [...new Set(member_ids.filter((id): id is string => typeof id === 'string' && !!id))];
    const supabase = createServiceClient();

    const { data: taskForce, error: tfError } = await supabase
      .from('task_force')
      .insert({
        name: name.slice(0, 80),
        status: 'active',
        dma_id: auth.user.email ?? null,
        assignment_id: assignment_id || null,
      })
      .select()
      .single();

    if (tfError) throw tfError;

    const { error: memberError } = await supabase
      .from('task_force_member')
      .insert(memberIds.map((volunteer_id, index) => ({
        task_force_id: taskForce.id,
        volunteer_id,
        member_type: index === 0 ? 'leader' : 'member',
      })));

    if (memberError) {
      // Don't leave an empty task force behind.
      await supabase.from('task_force').delete().eq('id', taskForce.id);
      throw memberError;
    }

    // Linking an existing mission hands it over to the new team.
    if (assignment_id) {
      await supabase
        .from('assignment')
        .update({ assigned_to_taskforce: taskForce.id, assigned_to_volunteer: null, updated_at: new Date().toISOString() })
        .eq('id', assignment_id);
    }

    await sendPushToVolunteers(
      supabase,
      memberIds,
      '👥 Added to task force',
      `You are now part of ${taskForce.name}`,
      `/volunteer/chat/${taskForce.id}`
    );

    return NextResponse.json(
      { ...taskForce, members: memberIds.map((volunteer_id) => ({ volunteer_id })) },
      { status: 201 }
    );
  } catch (err) {
    console.error('TaskForce POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
