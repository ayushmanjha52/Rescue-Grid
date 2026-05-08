import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get all task force members with their volunteer details including location
    const { data: members, error } = await supabase
      .from('task_force_member')
      .select(`
        task_force_id,
        volunteer:volunteer_id(
          id, name, mobile_no, type, status, latitude, longitude, last_seen
        )
      `);

    if (error) throw error;

    // Flatten the data for easier consumption
    const result = (members || [])
      .filter((m: any) => m.volunteer?.latitude && m.volunteer?.longitude) // Only include members with locations
      .map((m: any) => ({
        task_force_id: m.task_force_id,
        ...m.volunteer
      }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching TF member locations:', error);
    return NextResponse.json({ error: 'Failed to fetch member locations' }, { status: 500 });
  }
}
