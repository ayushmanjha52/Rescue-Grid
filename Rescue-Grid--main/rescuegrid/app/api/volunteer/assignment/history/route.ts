import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { fetchVolunteerAssignments } from '@/lib/assignments';
import { ASSIGNMENT_DONE } from '@/lib/status';

export async function GET() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const assignments = await fetchVolunteerAssignments(
      createServiceClient(),
      auth.volunteerId,
      ASSIGNMENT_DONE,
      'updated_at'
    );
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error in GET /api/volunteer/assignment/history:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
