import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { getMission, postDmaMissionMessage, transitionAssignment } from '@/lib/assignments';
import {
  formatMissionUpdate,
  isAssignmentDone,
  MAX_MISSION_NOTE_LENGTH,
  missionStatusHeadline,
  normalizeAssignmentStatus,
} from '@/lib/status';

// en_route / arrived let Command record progress a responder reported by phone
// (walk-in volunteers without the app); completed / failed close the mission.
const DMA_STATUSES = ['en_route', 'arrived', 'completed', 'failed'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = normalizeAssignmentStatus(String(body.status || ''));
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!DMA_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Status must be one of ${DMA_STATUSES.join(', ')}` }, { status: 400 });
    }
    if (note.length > MAX_MISSION_NOTE_LENGTH) {
      return NextResponse.json({ error: `Note must be at most ${MAX_MISSION_NOTE_LENGTH} characters` }, { status: 400 });
    }

    const supabase = createServiceClient();
    const mission = await getMission(supabase, id);

    if (!mission) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    if (isAssignmentDone(mission.status)) {
      return NextResponse.json({ error: `Assignment is already ${mission.status}` }, { status: 409 });
    }

    const assignment = await transitionAssignment(supabase, id, status);

    // Keep the mission timeline complete. Closing already pushes to responders,
    // so the log entry itself is silent.
    if (mission.assigned_to_volunteer || mission.assigned_to_taskforce) {
      try {
        await postDmaMissionMessage(
          supabase,
          mission,
          formatMissionUpdate(`${missionStatusHeadline(status)} (logged by Command)`, mission.task, note),
          { notify: false }
        );
      } catch (logError) {
        console.error('Mission update log failed (is migration 017 applied?):', logError);
      }
    }

    return NextResponse.json(assignment);
  } catch (err) {
    console.error('Assignment PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
