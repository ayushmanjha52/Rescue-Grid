import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { getMissionForVolunteer, postVolunteerMissionUpdate, transitionAssignment } from '@/lib/assignments';
import {
  formatMissionUpdate,
  isAssignmentDone,
  MAX_MISSION_NOTE_LENGTH,
  missionStatusHeadline,
  normalizeAssignmentStatus,
  VOLUNTEER_ASSIGNMENT_STATUSES,
} from '@/lib/status';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = normalizeAssignmentStatus(String(body.status || body.action || ''));
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!(VOLUNTEER_ASSIGNMENT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (note.length > MAX_MISSION_NOTE_LENGTH) {
      return NextResponse.json({ error: `Note must be at most ${MAX_MISSION_NOTE_LENGTH} characters` }, { status: 400 });
    }

    const access = await getMissionForVolunteer(supabase, id, volunteerId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const { mission } = access;

    if (isAssignmentDone(mission.status)) {
      return NextResponse.json({ error: `Mission is already ${mission.status}` }, { status: 409 });
    }

    const statusChanged = normalizeAssignmentStatus(mission.status) !== status;
    const updated = await transitionAssignment(supabase, id, status, volunteerId);

    // Every step lands in Command's Messages and on the mission timeline. The
    // status change itself has already succeeded, so a logging failure is only reported.
    if (statusChanged || note) {
      try {
        await postVolunteerMissionUpdate(
          supabase,
          mission,
          volunteerId,
          formatMissionUpdate(missionStatusHeadline(status), mission.task, note),
          status === 'failed'
        );
      } catch (logError) {
        console.error('Mission update log failed (is migration 017 applied?):', logError);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/assignment/[id]:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
