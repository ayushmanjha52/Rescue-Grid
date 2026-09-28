import type { createServiceClient } from '@/lib/supabase/service';
import { sendPushToVolunteers } from '@/lib/push/sendPush';
import { notifyReportUpdated } from '@/lib/notify';
import { isTaskForceMember } from '@/lib/auth/getVolunteer';
import { withSenderNames } from '@/lib/messages';
import {
  ASSIGNMENT_IN_PROGRESS,
  isAssignmentDone,
  normalizeAssignmentStatus,
  reportStatusForAssignment,
} from '@/lib/status';

type ServiceClient = ReturnType<typeof createServiceClient>;

/** The fields needed to route messages about a mission. */
export interface MissionRef {
  id: string;
  task: string;
  status: string;
  assigned_to_volunteer: string | null;
  assigned_to_taskforce: string | null;
}

const MISSION_REF_FIELDS = 'id, task, status, assigned_to_volunteer, assigned_to_taskforce';

export async function getMission(supabase: ServiceClient, assignmentId: string): Promise<MissionRef | null> {
  const { data } = await supabase.from('assignment').select(MISSION_REF_FIELDS).eq('id', assignmentId).maybeSingle();
  return (data as MissionRef | null) ?? null;
}

/**
 * Loads a mission for a volunteer, checking that it is assigned to them
 * directly or to one of their task forces.
 */
export async function getMissionForVolunteer(
  supabase: ServiceClient,
  assignmentId: string,
  volunteerId: string
): Promise<{ mission: MissionRef } | { error: string; status: 403 | 404 }> {
  const mission = await getMission(supabase, assignmentId);
  if (!mission) return { error: 'Assignment not found', status: 404 };

  const allowed =
    mission.assigned_to_volunteer === volunteerId ||
    (!!mission.assigned_to_taskforce && (await isTaskForceMember(supabase, volunteerId, mission.assigned_to_taskforce)));

  return allowed ? { mission } : { error: 'Forbidden', status: 403 };
}

/**
 * Records a responder's update on a mission. It is posted to the team room for
 * task-force missions (so teammates see it too) and otherwise to the
 * volunteer's direct thread with Command. Either way it appears in DMA
 * Messages and on the mission's timeline.
 */
export async function postVolunteerMissionUpdate(
  supabase: ServiceClient,
  mission: MissionRef,
  volunteerId: string,
  content: string,
  flagForDma = false
) {
  const { data, error } = await supabase
    .from('message')
    .insert({
      content,
      sender_type: 'volunteer',
      sender_id: volunteerId,
      receiver_id: null,
      task_force_id: mission.assigned_to_taskforce ?? null,
      victim_report_id: null,
      assignment_id: mission.id,
      is_flagged_for_dma: flagForDma,
    })
    .select()
    .single();

  if (error) throw error;

  // Bump the mission so dashboards re-sort it as recently updated.
  await supabase.from('assignment').update({ updated_at: new Date().toISOString() }).eq('id', mission.id);
  return data;
}

/**
 * Command writes to the responders about a specific mission. They get a push
 * notification unless `notify` is false (e.g. Command logging a status it
 * was told over the phone).
 */
export async function postDmaMissionMessage(
  supabase: ServiceClient,
  mission: MissionRef,
  content: string,
  { notify = true }: { notify?: boolean } = {}
) {
  const { data, error } = await supabase
    .from('message')
    .insert({
      content,
      sender_type: 'dma',
      task_force_id: mission.assigned_to_taskforce ?? null,
      receiver_id: mission.assigned_to_taskforce ? null : mission.assigned_to_volunteer,
      victim_report_id: null,
      assignment_id: mission.id,
    })
    .select()
    .single();

  if (error) throw error;
  if (!notify) return data;

  await sendPushToVolunteers(
    supabase,
    await getAssignmentRecipients(supabase, mission),
    '📨 DMA Command · mission',
    content.slice(0, 120),
    mission.assigned_to_taskforce ? `/volunteer/chat/${mission.assigned_to_taskforce}` : '/volunteer/active'
  );
  return data;
}

/** Every message about a mission, oldest first, with sender names. */
export async function fetchMissionUpdates(supabase: ServiceClient, assignmentId: string) {
  const { data, error } = await supabase
    .from('message')
    .select('id, content, sender_type, sender_id, is_flagged_for_dma, created_at, assignment_id')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw error;
  return withSenderNames(supabase, data || []);
}

const VOLUNTEER_ASSIGNMENT_SELECT = `
  *,
  volunteer:assigned_to_volunteer(id, name, mobile_no, type),
  task_force:assigned_to_taskforce(id, name),
  victim_report:victim_report_id(id, situation, urgency, status, custom_message)
`;

/**
 * Assignments visible to a volunteer: those assigned to them directly plus
 * those assigned to any task force they belong to.
 */
export async function fetchVolunteerAssignments(
  supabase: ServiceClient,
  volunteerId: string,
  statuses: readonly string[],
  orderBy: 'created_at' | 'updated_at' = 'created_at'
) {
  const { data: memberships } = await supabase
    .from('task_force_member')
    .select('task_force_id')
    .eq('volunteer_id', volunteerId);
  const taskForceIds = (memberships || []).map((m: { task_force_id: string }) => m.task_force_id);

  let query = supabase
    .from('assignment')
    .select(VOLUNTEER_ASSIGNMENT_SELECT)
    .in('status', statuses as string[]);

  query = taskForceIds.length > 0
    ? query.or(`assigned_to_volunteer.eq.${volunteerId},assigned_to_taskforce.in.(${taskForceIds.join(',')})`)
    : query.eq('assigned_to_volunteer', volunteerId);

  const { data, error } = await query.order(orderBy, { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Volunteer ids that should receive notifications for an assignment. */
export async function getAssignmentRecipients(
  supabase: ServiceClient,
  assignment: { assigned_to_volunteer: string | null; assigned_to_taskforce: string | null }
): Promise<string[]> {
  if (assignment.assigned_to_volunteer) return [assignment.assigned_to_volunteer];
  if (!assignment.assigned_to_taskforce) return [];
  const { data } = await supabase
    .from('task_force_member')
    .select('volunteer_id')
    .eq('task_force_id', assignment.assigned_to_taskforce);
  return (data || []).map((m: { volunteer_id: string }) => m.volunteer_id);
}

/**
 * Marks volunteers "on-mission" while they are working an assignment and puts
 * them back to "active" once they have nothing left in progress. Volunteers who
 * switched themselves offline are left alone.
 */
export async function syncVolunteerMissionStatus(supabase: ServiceClient, volunteerIds: string[]) {
  for (const volunteerId of volunteerIds) {
    const { data: volunteer } = await supabase
      .from('volunteer')
      .select('status')
      .eq('id', volunteerId)
      .single();
    if (!volunteer || (volunteer.status !== 'active' && volunteer.status !== 'on-mission')) continue;

    const taskForceIds = (
      (await supabase.from('task_force_member').select('task_force_id').eq('volunteer_id', volunteerId)).data || []
    ).map((m: { task_force_id: string }) => m.task_force_id);

    const inProgress = ASSIGNMENT_IN_PROGRESS.filter((s) => s !== 'active') as string[];
    let query = supabase
      .from('assignment')
      .select('id', { count: 'exact', head: true })
      .in('status', inProgress);
    query = taskForceIds.length > 0
      ? query.or(`assigned_to_volunteer.eq.${volunteerId},assigned_to_taskforce.in.(${taskForceIds.join(',')})`)
      : query.eq('assigned_to_volunteer', volunteerId);

    const { count } = await query;
    const nextStatus = (count || 0) > 0 ? 'on-mission' : 'active';
    if (nextStatus !== volunteer.status) {
      await supabase.from('volunteer').update({ status: nextStatus }).eq('id', volunteerId);
    }
  }
}

/**
 * Applies a status change to an assignment and keeps the linked victim report
 * and the responders' availability in sync.
 */
export async function transitionAssignment(
  supabase: ServiceClient,
  assignmentId: string,
  rawStatus: string,
  actingVolunteerId?: string
) {
  const status = normalizeAssignmentStatus(rawStatus);

  const { data: assignment, error } = await supabase
    .from('assignment')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;

  if (assignment.victim_report_id) {
    let reportStatus = reportStatusForAssignment(status);

    // Don't reopen a report while another team is still working it.
    if (status === 'failed') {
      const { count } = await supabase
        .from('assignment')
        .select('id', { count: 'exact', head: true })
        .eq('victim_report_id', assignment.victim_report_id)
        .neq('id', assignment.id)
        .in('status', ASSIGNMENT_IN_PROGRESS as unknown as string[]);
      if ((count || 0) > 0) reportStatus = 'assigned';
    }

    await supabase
      .from('victim_report')
      .update({ status: reportStatus, updated_at: new Date().toISOString() })
      .eq('id', assignment.victim_report_id);
    await notifyReportUpdated(assignment.victim_report_id);
  }

  const recipients = await getAssignmentRecipients(supabase, assignment);
  const affected = new Set(recipients);
  if (actingVolunteerId) affected.add(actingVolunteerId);
  await syncVolunteerMissionStatus(supabase, [...affected]);

  // If DMA closed the mission, tell the responders so they don't keep driving.
  if (!actingVolunteerId && isAssignmentDone(status)) {
    await sendPushToVolunteers(
      supabase,
      recipients,
      status === 'completed' ? '✓ Mission closed' : '✗ Mission cancelled',
      assignment.task,
      '/volunteer/missions'
    );
  }

  return assignment;
}
