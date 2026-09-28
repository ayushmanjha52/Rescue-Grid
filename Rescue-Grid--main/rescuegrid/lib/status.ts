// Single source of truth for the status vocabularies used across the app.

// ---- Victim reports -------------------------------------------------------

export const SITUATIONS = ['food', 'water', 'medical', 'rescue', 'shelter', 'missing'] as const;
export type Situation = (typeof SITUATIONS)[number];

export function isSituation(value: unknown): value is Situation {
  return typeof value === 'string' && (SITUATIONS as readonly string[]).includes(value);
}

export const URGENCIES = ['critical', 'urgent', 'moderate'] as const;
export type Urgency = (typeof URGENCIES)[number];

export function isUrgency(value: unknown): value is Urgency {
  return typeof value === 'string' && (URGENCIES as readonly string[]).includes(value);
}

/** Default triage urgency for a new report, shared by the web form and the SMS gateway. */
export const SITUATION_URGENCY: Record<Situation, Urgency> = {
  rescue: 'critical',
  medical: 'critical',
  missing: 'urgent',
  food: 'urgent',
  water: 'urgent',
  shelter: 'moderate',
};

export const REPORT_STATUSES = ['open', 'verified', 'assigned', 'en_route', 'arrived', 'resolved', 'duplicate'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && (REPORT_STATUSES as readonly string[]).includes(value);
}

/** Short human-readable reference for a report, e.g. "RG-2026-3F2A". */
export function reportReference(id: string, createdAt?: string | null): string {
  const created = createdAt ? new Date(createdAt) : null;
  const year = created && !Number.isNaN(created.getTime()) ? created.getFullYear() : new Date().getFullYear();
  return `RG-${year}-${id.slice(0, 4).toUpperCase()}`;
}

// ---- Assignments ----------------------------------------------------------

/**
 * Assignment lifecycle: open → active (assigned, not started) → en_route → arrived → completed | failed.
 * `on_my_way` and `on-mission` are legacy spellings that may still exist in older rows.
 */
export const ASSIGNMENT_IN_PROGRESS = ['active', 'en_route', 'on_my_way', 'arrived', 'on-mission'] as const;
export const ASSIGNMENT_PENDING = ['open', ...ASSIGNMENT_IN_PROGRESS] as const;
export const ASSIGNMENT_DONE = ['completed', 'failed'] as const;

export const VOLUNTEER_ASSIGNMENT_STATUSES = ['active', 'en_route', 'arrived', 'completed', 'failed'] as const;

export function normalizeAssignmentStatus(status: string): string {
  if (status === 'on_my_way' || status === 'on-mission') return 'en_route';
  return status;
}

export function isAssignmentInProgress(status: string): boolean {
  return (ASSIGNMENT_IN_PROGRESS as readonly string[]).includes(status);
}

export function isAssignmentDone(status: string): boolean {
  return (ASSIGNMENT_DONE as readonly string[]).includes(status);
}

/** The victim report status that mirrors an assignment status. */
export function reportStatusForAssignment(status: string): ReportStatus {
  switch (normalizeAssignmentStatus(status)) {
    case 'en_route':
      return 'en_route';
    case 'arrived':
      return 'arrived';
    case 'completed':
      return 'resolved';
    case 'failed':
      // The victim still needs help — put the report back in the queue.
      return 'open';
    default:
      return 'assigned';
  }
}

export function assignmentStatusLabel(status: string): string {
  switch (normalizeAssignmentStatus(status)) {
    case 'open':
      return 'QUEUED';
    case 'active':
      return 'ASSIGNED';
    case 'en_route':
      return 'EN ROUTE';
    case 'arrived':
      return 'ON SITE';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    default:
      return status.toUpperCase();
  }
}

// ---- Mission updates ------------------------------------------------------

export const MAX_MISSION_NOTE_LENGTH = 500;

/** How a responder's status change reads in the mission timeline and in Messages. */
export function missionStatusHeadline(status: string): string {
  switch (normalizeAssignmentStatus(status)) {
    case 'active':
      return '📋 Mission acknowledged';
    case 'en_route':
      return '🚗 On the way';
    case 'arrived':
      return '📍 Arrived on site';
    case 'completed':
      return '✅ Mission completed';
    case 'failed':
      return '⚠️ Could not complete the mission';
    default:
      return `Status: ${assignmentStatusLabel(status)}`;
  }
}

export const MISSION_NOTE_HEADLINE = '📝 Field update';

/**
 * Message text for a mission update: a headline naming the mission on the
 * first line, then the responder's own note, if any.
 */
export function formatMissionUpdate(headline: string, task: string, note?: string | null): string {
  const title = task.length > 80 ? `${task.slice(0, 79)}…` : task;
  const cleanNote = note?.trim();
  return cleanNote ? `${headline} · ${title}\n${cleanNote}` : `${headline} · ${title}`;
}

// ---- Resource allocations -------------------------------------------------

export const ALLOCATION_ACTIVE = ['allocated', 'in_use'] as const;
export const ALLOCATION_TERMINAL = ['consumed', 'returned', 'lost'] as const;
export const ALLOCATION_STATUSES = [...ALLOCATION_ACTIVE, ...ALLOCATION_TERMINAL] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export function isAllocationStatus(value: unknown): value is AllocationStatus {
  return typeof value === 'string' && (ALLOCATION_STATUSES as readonly string[]).includes(value);
}
