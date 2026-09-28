import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';

const TASK_FORCE_STATUSES = ['active', 'dissolved'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('task_force')
    .select('id, name, status, assignment_id, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('TaskForce GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Task force not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const { status, addVolunteer, removeVolunteer } = await req.json().catch(() => ({}));

    const supabase = createServiceClient();

    if (status) {
      if (!TASK_FORCE_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Status must be active or dissolved' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('task_force')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (addVolunteer) {
      const { data: existing } = await supabase
        .from('task_force_member')
        .select('id')
        .eq('task_force_id', id)
        .eq('volunteer_id', addVolunteer)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'Volunteer already a member' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('task_force_member')
        .insert({ task_force_id: id, volunteer_id: addVolunteer, member_type: 'member' })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (removeVolunteer) {
      const { error } = await supabase
        .from('task_force_member')
        .delete()
        .eq('task_force_id', id)
        .eq('volunteer_id', removeVolunteer);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid update operation provided' }, { status: 400 });
  } catch (err) {
    console.error('TaskForce PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
