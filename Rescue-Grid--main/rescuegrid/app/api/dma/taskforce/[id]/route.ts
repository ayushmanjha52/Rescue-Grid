import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, addVolunteer, removeVolunteer } = body;

    const supabase = createServiceClient();

    if (status) {
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
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Volunteer already a member' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('task_force_member')
        .insert({ task_force_id: id, volunteer_id: addVolunteer })
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
