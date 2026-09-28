import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { fetchVolunteerAssignments } from '@/lib/assignments';
import { ASSIGNMENT_IN_PROGRESS, normalizeAssignmentStatus } from '@/lib/status';

// A mission the volunteer is already working on outranks one that is only assigned.
const PROGRESS_RANK: Record<string, number> = { arrived: 0, en_route: 1, active: 2 };

export async function GET() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const assignments = await fetchVolunteerAssignments(
      createServiceClient(),
      auth.volunteerId,
      ASSIGNMENT_IN_PROGRESS
    );

    const [current] = [...assignments].sort((a, b) => {
      const rankA = PROGRESS_RANK[normalizeAssignmentStatus(a.status)] ?? 3;
      const rankB = PROGRESS_RANK[normalizeAssignmentStatus(b.status)] ?? 3;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json(current ?? null);
  } catch (error) {
    console.error('Error in GET /api/volunteer/assignment/active:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
