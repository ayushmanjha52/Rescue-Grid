import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import { normalizePhone } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase/admin';
import { createVolunteerLogin, generateTempPin } from '@/lib/auth/volunteerAccounts';
import { ASSIGNMENT_IN_PROGRESS } from '@/lib/status';
import {
  isSkillIdList,
  setVolunteerSkills,
  toVolunteerType,
  validateVolunteerName,
} from '@/lib/volunteers';

type ServiceClient = ReturnType<typeof createServiceClient>;

interface VolunteerRow {
  id: string;
  name: string;
  mobile_no: string;
  type: string | null;
  status: string | null;
  tier: number | null;
  skills: string | null;
  equipment: string | null;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
  auth_id: string | null;
  push_token: string | null;
  created_at?: string | null; // added by migration 017
}

interface MissionRow {
  id: string;
  task: string;
  status: string;
  urgency: string | null;
  updated_at: string | null;
  assigned_to_volunteer: string | null;
  assigned_to_taskforce: string | null;
  task_force: { name: string } | null;
}

interface CurrentMission {
  id: string;
  task: string;
  status: string;
  urgency: string | null;
  updated_at: string | null;
  task_force_name: string | null;
}

/** Each volunteer's most recent in-progress mission, direct or through a task force. */
async function currentMissions(supabase: ServiceClient) {
  const { data: missions } = await supabase
    .from('assignment')
    .select('id, task, status, urgency, updated_at, assigned_to_volunteer, assigned_to_taskforce, task_force:assigned_to_taskforce(name)')
    .in('status', ASSIGNMENT_IN_PROGRESS as unknown as string[])
    .order('updated_at', { ascending: false })
    .limit(1000);

  const rows = (missions || []) as unknown as MissionRow[];
  const taskForceIds = [...new Set(rows.map((m) => m.assigned_to_taskforce).filter(Boolean))] as string[];

  const membersByTaskForce: Record<string, string[]> = {};
  if (taskForceIds.length > 0) {
    const { data: members } = await supabase
      .from('task_force_member')
      .select('task_force_id, volunteer_id')
      .in('task_force_id', taskForceIds);
    for (const m of members || []) (membersByTaskForce[m.task_force_id] ||= []).push(m.volunteer_id);
  }

  const byVolunteer: Record<string, CurrentMission> = {};
  // Rows are newest first, so the first mission seen per volunteer wins.
  for (const m of rows) {
    const mission: CurrentMission = {
      id: m.id,
      task: m.task,
      status: m.status,
      urgency: m.urgency,
      updated_at: m.updated_at,
      task_force_name: m.task_force?.name ?? null,
    };
    const volunteerIds = m.assigned_to_volunteer
      ? [m.assigned_to_volunteer]
      : membersByTaskForce[m.assigned_to_taskforce || ''] || [];
    for (const id of volunteerIds) byVolunteer[id] ||= mission;
  }
  return byVolunteer;
}

/** The last thing each volunteer told Command (direct message, team room or mission update). */
async function lastMessages(supabase: ServiceClient) {
  const { data } = await supabase
    .from('message')
    .select('sender_id, content, created_at')
    .eq('sender_type', 'volunteer')
    .not('sender_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3000);

  const latest: Record<string, { content: string; created_at: string }> = {};
  for (const m of data || []) {
    if (m.sender_id && !latest[m.sender_id]) latest[m.sender_id] = { content: m.content, created_at: m.created_at };
  }
  return latest;
}

/** Command's volunteer roster: who is available, what they're doing, and when we last heard from them. */
export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    // `*` keeps this working before migration 017 adds created_at.
    const [{ data: volunteers, error }, missions, messages] = await Promise.all([
      supabase.from('volunteer').select('*').order('name').limit(5000),
      currentMissions(supabase),
      lastMessages(supabase),
    ]);
    if (error) throw error;

    return NextResponse.json(
      ((volunteers || []) as VolunteerRow[]).map((v) => ({
        id: v.id,
        name: v.name,
        mobile_no: v.mobile_no,
        type: v.type,
        status: v.status || 'offline',
        tier: v.tier,
        skills: v.skills,
        equipment: v.equipment,
        last_seen: v.last_seen,
        latitude: v.latitude,
        longitude: v.longitude,
        created_at: v.created_at ?? null,
        // "Using the app" = has sent a location or enabled alerts. Walk-ins get
        // a login at registration, so auth_id alone doesn't mean they use it.
        has_app: !!v.last_seen || !!v.push_token,
        has_push: !!v.push_token,
        current_mission: missions[v.id] ?? null,
        last_message: messages[v.id] ?? null,
      }))
    );
  } catch (error) {
    console.error('Error in GET /api/dma/volunteers:', error);
    return NextResponse.json({ error: 'Failed to load volunteers' }, { status: 500 });
  }
}

/**
 * Registers a walk-in volunteer (e.g. someone who turned up at a relief camp).
 * They can be tasked straight away; when they later sign in to the volunteer
 * app with the same phone number, the account is linked to this record.
 */
export async function POST(request: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const name = validateVolunteerName(body.name);
    const phone = normalizePhone(body.phone);

    if (!name) {
      return NextResponse.json({ error: 'Name must be 2–80 characters' }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: 'Enter a valid mobile number' }, { status: 400 });
    }
    if (body.skill_ids !== undefined && !isSkillIdList(body.skill_ids)) {
      return NextResponse.json({ error: 'skill_ids must be an array of integers' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('volunteer')
      .select('id, name, status')
      .eq('mobile_no', phone)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: `${existing.name} is already registered with this number`, volunteer: existing },
        { status: 409 }
      );
    }

    // Give them a login straight away: Command hands over the temporary PIN,
    // and they can use the volunteer app whenever they get a smartphone.
    const tempPin = generateTempPin();
    const admin = createAdminClient();
    let authId: string;
    try {
      authId = await createVolunteerLogin(admin, phone, tempPin);
    } catch (loginError) {
      console.error('Walk-in login creation failed:', loginError);
      return NextResponse.json({ error: 'This number already has a login' }, { status: 409 });
    }

    const { data: volunteer, error } = await supabase
      .from('volunteer')
      .insert({
        name,
        mobile_no: phone,
        auth_id: authId,
        type: toVolunteerType(body.type),
        equipment: typeof body.equipment === 'string' ? body.equipment.slice(0, 500) : null,
        status: 'active',
      })
      .select('id, name, mobile_no, type, status')
      .single();

    if (error) {
      await admin.auth.admin.deleteUser(authId);
      // Unique violation: registered by someone else a moment ago.
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This number is already registered' }, { status: 409 });
      }
      throw error;
    }

    if (Array.isArray(body.skill_ids) && body.skill_ids.length > 0) {
      const codes = await setVolunteerSkills(supabase, volunteer.id, body.skill_ids);
      await supabase.from('volunteer').update({ skills: codes }).eq('id', volunteer.id);
    }

    return NextResponse.json({ ...volunteer, temp_pin: tempPin }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/dma/volunteers:', error);
    return NextResponse.json({ error: 'Failed to register volunteer' }, { status: 500 });
  }
}
