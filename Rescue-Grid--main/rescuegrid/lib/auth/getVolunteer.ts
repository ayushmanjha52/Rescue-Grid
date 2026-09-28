import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isVolunteerAuthUser } from '@/lib/auth/volunteerAccess';
import { getAuthUser, type AuthUser } from '@/lib/auth/session';

export interface VolunteerIdentity {
  volunteerId: string;
  name: string;
  phone: string;
  user: AuthUser;
}

/**
 * Resolves the logged-in volunteer from their Supabase Auth session (set at
 * phone + PIN sign-in). Returns null when there is no session or it doesn't belong to a volunteer.
 */
export async function getVolunteer(): Promise<VolunteerIdentity | null> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user || !isVolunteerAuthUser(user)) return null;

  // Service client: the lookup must work regardless of RLS.
  const { data: volunteer } = await createServiceClient()
    .from('volunteer')
    .select('id, name, mobile_no')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!volunteer) return null;
  return { volunteerId: volunteer.id, name: volunteer.name, phone: volunteer.mobile_no, user };
}

/**
 * For route handlers: resolves the logged-in volunteer id, or returns a 401
 * response to send back as-is.
 */
export async function requireVolunteer(): Promise<
  (VolunteerIdentity & { response?: never }) |
  { volunteerId?: never; response: NextResponse }
> {
  const identity = await getVolunteer();
  if (!identity) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return identity;
}

/** Returns the ids of every task force the volunteer belongs to. */
export async function getVolunteerTaskForceIds(
  supabase: ReturnType<typeof createServiceClient>,
  volunteerId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('task_force_member')
    .select('task_force_id')
    .eq('volunteer_id', volunteerId);
  return (data || []).map((m: { task_force_id: string }) => m.task_force_id);
}

export async function isTaskForceMember(
  supabase: ReturnType<typeof createServiceClient>,
  volunteerId: string,
  taskForceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('task_force_member')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .eq('task_force_id', taskForceId)
    .limit(1);
  return (data?.length || 0) > 0;
}
