import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LEGACY_VOLUNTEER_COOKIE } from '@/lib/auth/volunteerAccess';
import { deleteVolunteerAccount, isSkillIdList, setVolunteerSkills, validateVolunteerName } from '@/lib/volunteers';

const PROFILE_FIELDS = 'id, name, mobile_no, type, skills, equipment, status, last_seen, tier';

async function loadSkillIds(supabase: ReturnType<typeof createServiceClient>, volunteerId: string) {
  const { data: skillRows } = await supabase
    .from('volunteer_skills')
    .select('skill_id')
    .eq('volunteer_id', volunteerId);
  return skillRows?.map((r: { skill_id: number }) => r.skill_id) || [];
}

export async function GET() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();

    const { data: volunteer, error } = await supabase
      .from('volunteer')
      .select(PROFILE_FIELDS)
      .eq('id', volunteerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching volunteer:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!volunteer) {
      // Session points at a volunteer that no longer exists.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ ...volunteer, skill_ids: await loadSkillIds(supabase, volunteerId) });
  } catch (error) {
    console.error('Error in GET /api/volunteer/me:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** Deletes the volunteer's account and personal data at their request. */
export async function DELETE(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });
    }

    const result = await deleteVolunteerAccount(createServiceClient(), auth.volunteerId);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }

    // End the session (clears cookies), then remove the phone login itself.
    const supabase = await createClient();
    await supabase.auth.signOut();
    const { error: authError } = await createAdminClient().auth.admin.deleteUser(auth.user.id);
    if (authError) console.error('Auth user deletion failed (volunteer data already removed):', authError);

    const response = NextResponse.json({ success: true });
    response.cookies.delete(LEGACY_VOLUNTEER_COOKIE);
    return response;
  } catch (error) {
    console.error('Error in DELETE /api/volunteer/me:', error);
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));
    const { name, skills, equipment, skill_ids } = body;

    const updateData: { name?: string; skills?: string; equipment?: string } = {};

    if (name !== undefined) {
      const validName = validateVolunteerName(name);
      if (!validName) {
        return NextResponse.json({ error: 'Name must be 2–80 characters' }, { status: 400 });
      }
      updateData.name = validName;
    }
    if (typeof skills === 'string') {
      updateData.skills = skills.slice(0, 500);
    }
    if (typeof equipment === 'string') {
      updateData.equipment = equipment.slice(0, 500);
    }

    if (skill_ids !== undefined) {
      if (!isSkillIdList(skill_ids)) {
        return NextResponse.json({ error: 'skill_ids must be an array of integers' }, { status: 400 });
      }
      const codes = await setVolunteerSkills(supabase, volunteerId, skill_ids);
      // Keep the legacy free-text column in sync so text search still works.
      if (updateData.skills === undefined) updateData.skills = codes;
    }

    let volunteer = null;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabase
        .from('volunteer')
        .update(updateData)
        .eq('id', volunteerId)
        .select(PROFILE_FIELDS)
        .single();

      if (error) {
        console.error('Error updating volunteer:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }
      volunteer = data;
    } else {
      const { data } = await supabase
        .from('volunteer')
        .select(PROFILE_FIELDS)
        .eq('id', volunteerId)
        .single();
      volunteer = data;
    }

    return NextResponse.json({ ...volunteer, skill_ids: await loadSkillIds(supabase, volunteerId) });
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/me:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
