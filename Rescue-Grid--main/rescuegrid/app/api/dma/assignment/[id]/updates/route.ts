import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { fetchMissionUpdates, getMission, postDmaMissionMessage } from '@/lib/assignments';
import { cleanMessageContent, MAX_MESSAGE_LENGTH, withSenderNames } from '@/lib/messages';

type Params = { params: Promise<{ id: string }> };

/** Mission timeline for Command. */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const supabase = createServiceClient();
    if (!(await getMission(supabase, id))) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json(await fetchMissionUpdates(supabase, id));
  } catch (error) {
    console.error('Error in GET /api/dma/assignment/[id]/updates:', error);
    return NextResponse.json({ error: 'Failed to load mission updates' }, { status: 500 });
  }
}

/** Command replies to the responders about this mission. */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const content = cleanMessageContent(body.content);
    if (!content) {
      return NextResponse.json({ error: `Message required (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 });
    }

    const { id } = await params;
    const supabase = createServiceClient();
    const mission = await getMission(supabase, id);
    if (!mission) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    if (!mission.assigned_to_volunteer && !mission.assigned_to_taskforce) {
      return NextResponse.json({ error: 'This mission has no responder yet' }, { status: 409 });
    }

    const message = await postDmaMissionMessage(supabase, mission, content);
    const [withName] = await withSenderNames(supabase, [message]);
    return NextResponse.json(withName, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/dma/assignment/[id]/updates:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
