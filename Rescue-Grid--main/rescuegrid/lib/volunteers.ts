import type { createServiceClient } from '@/lib/supabase/service';

type ServiceClient = ReturnType<typeof createServiceClient>;

export const VOLUNTEER_TYPES = ['Individual', 'NGO', 'Police', 'NDRF'] as const;
export type VolunteerType = (typeof VOLUNTEER_TYPES)[number];

export function toVolunteerType(value: unknown): VolunteerType {
  const match = VOLUNTEER_TYPES.find((t) => t.toLowerCase() === String(value ?? '').toLowerCase());
  return match ?? 'Individual';
}

/** Volunteers who joined within this window are highlighted to Command as new. */
export const NEW_VOLUNTEER_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isNewVolunteer(createdAt: string | null | undefined, now: number): boolean {
  if (!createdAt) return false;
  const joined = new Date(createdAt).getTime();
  return Number.isFinite(joined) && now - joined < NEW_VOLUNTEER_WINDOW_MS;
}

/** Name given to self-registered volunteers until they fill in their profile. */
export function placeholderVolunteerName(phone: string): string {
  return `Volunteer ${phone.slice(-4)}`;
}

export function hasPlaceholderName(name: string | null | undefined): boolean {
  return !name || /^Volunteer \d{4}$/.test(name.trim());
}

export function validateVolunteerName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed.length >= 2 && trimmed.length <= 80 ? trimmed : null;
}

export function isSkillIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isInteger(id));
}

/**
 * Erases a volunteer's personal data at their request. Refuses while they
 * still have work in progress or supplies checked out, because Command
 * depends on those records. Afterwards:
 *   - their profile, skills, location and task-force memberships are deleted;
 *   - their direct conversation with Command is deleted;
 *   - messages they posted in team rooms or mission timelines stay (teammates
 *     rely on them) but no longer name them;
 *   - closed missions and returned supplies stay in the records, unassigned.
 */
export async function deleteVolunteerAccount(
  supabase: ServiceClient,
  volunteerId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: memberships } = await supabase
    .from('task_force_member')
    .select('task_force_id')
    .eq('volunteer_id', volunteerId);
  const taskForceIds = (memberships || []).map((m: { task_force_id: string }) => m.task_force_id);

  let activeMissions = supabase
    .from('assignment')
    .select('id', { count: 'exact', head: true })
    .in('status', ['en_route', 'on_my_way', 'arrived', 'on-mission']);
  activeMissions = taskForceIds.length > 0
    ? activeMissions.or(`assigned_to_volunteer.eq.${volunteerId},assigned_to_taskforce.in.(${taskForceIds.join(',')})`)
    : activeMissions.eq('assigned_to_volunteer', volunteerId);
  const { count: missionCount } = await activeMissions;
  if ((missionCount || 0) > 0) {
    return { ok: false, reason: 'Finish or report your current mission before deleting your account.' };
  }

  const { count: supplyCount } = await supabase
    .from('resource_allocation')
    .select('id', { count: 'exact', head: true })
    .eq('volunteer_id', volunteerId)
    .in('status', ['allocated', 'in_use']);
  if ((supplyCount || 0) > 0) {
    return { ok: false, reason: 'Return or report the supplies you are holding before deleting your account.' };
  }

  // Missions assigned to them that never started go back to Command's queue,
  // and their victim reports become unassigned again.
  const { data: unstarted } = await supabase
    .from('assignment')
    .select('victim_report_id')
    .eq('assigned_to_volunteer', volunteerId)
    .eq('status', 'active');
  const reopenReportIds = (unstarted || [])
    .map((a: { victim_report_id: string | null }) => a.victim_report_id)
    .filter((id): id is string => !!id);

  const steps = [
    supabase.from('assignment').update({ assigned_to_volunteer: null, status: 'open' }).eq('assigned_to_volunteer', volunteerId).eq('status', 'active'),
    ...(reopenReportIds.length > 0
      ? [supabase.from('victim_report').update({ status: 'open' }).in('id', reopenReportIds).eq('status', 'assigned')]
      : []),
    // Closed missions and settled supplies stay in the records, unassigned.
    supabase.from('assignment').update({ assigned_to_volunteer: null }).eq('assigned_to_volunteer', volunteerId),
    supabase.from('resource_allocation').update({ volunteer_id: null }).eq('volunteer_id', volunteerId),
    // Direct conversation with Command.
    supabase.from('message').delete().is('task_force_id', null).is('victim_report_id', null).is('assignment_id', null)
      .or(`sender_id.eq.${volunteerId},receiver_id.eq.${volunteerId}`),
    // Team-room and mission messages stay for the team, without their name.
    supabase.from('message').update({ sender_id: null }).eq('sender_id', volunteerId),
    supabase.from('message').update({ receiver_id: null }).eq('receiver_id', volunteerId),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw error;
  }

  // Skills and task-force memberships are removed by ON DELETE CASCADE.
  const { error } = await supabase.from('volunteer').delete().eq('id', volunteerId);
  if (error) throw error;
  return { ok: true };
}

/**
 * Replaces a volunteer's normalized skills and returns the matching skill
 * codes, comma-separated, for the legacy free-text `volunteer.skills` column
 * (text search still reads it).
 */
export async function setVolunteerSkills(
  supabase: ServiceClient,
  volunteerId: string,
  skillIds: number[]
): Promise<string> {
  const { error: deleteError } = await supabase.from('volunteer_skills').delete().eq('volunteer_id', volunteerId);
  if (deleteError) throw deleteError;

  const uniqueIds = [...new Set(skillIds)];
  if (uniqueIds.length === 0) return '';

  const { error: insertError } = await supabase
    .from('volunteer_skills')
    .insert(uniqueIds.map((skillId) => ({ volunteer_id: volunteerId, skill_id: skillId })));
  if (insertError) throw insertError;

  const { data: defs } = await supabase.from('skill_definitions').select('code').in('id', uniqueIds);
  return (defs || []).map((d: { code: string }) => d.code).join(',');
}
