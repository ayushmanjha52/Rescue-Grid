import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { fetchMissionUpdates, getMissionForVolunteer, postVolunteerMissionUpdate } from '@/lib/assignments';
import { withSenderNames } from '@/lib/messages';
import { formatMissionUpdate, isAssignmentDone, MAX_MISSION_NOTE_LENGTH, MISSION_NOTE_HEADLINE } from '@/lib/status';

type Params = { params: Promise<{ id: string }> };

/** The mission log: every update from the responders and Command about this mission. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { id } = await params;
    const access = await getMissionForVolunteer(supabase, id, auth.volunteerId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    return NextResponse.json(await fetchMissionUpdates(supabase, id));
  } catch (error) {
    console.error('Error in GET /api/volunteer/assignment/[id]/updates:', error);
    return NextResponse.json({ error: 'Failed to load mission updates' }, { status: 500 });
  }
}

/** A field update from the responder, e.g. "road blocked, taking the east route". */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const note = typeof body.content === 'string' ? body.content.trim() : '';
    if (!note || note.length > MAX_MISSION_NOTE_LENGTH) {
      return NextResponse.json({ error: `Update must be 1–${MAX_MISSION_NOTE_LENGTH} characters` }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { id } = await params;
    const access = await getMissionForVolunteer(supabase, id, auth.volunteerId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (isAssignmentDone(access.mission.status)) {
      return NextResponse.json({ error: `Mission is already ${access.mission.status}` }, { status: 409 });
    }

    const message = await postVolunteerMissionUpdate(
      supabase,
      access.mission,
      auth.volunteerId,
      formatMissionUpdate(MISSION_NOTE_HEADLINE, access.mission.task, note),
      body.flag === true
    );

    const [withName] = await withSenderNames(supabase, [message]);
    return NextResponse.json(withName, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/volunteer/assignment/[id]/updates:', error);
    return NextResponse.json({ error: 'Failed to send update' }, { status: 500 });
  }
}
