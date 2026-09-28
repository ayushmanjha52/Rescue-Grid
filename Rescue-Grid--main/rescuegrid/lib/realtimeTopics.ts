// Broadcast topics shared by server (sender) and browser (listener).

/** Realtime broadcast topic for one victim report. The report UUID is the only way to find it. */
export function reportTopic(reportId: string) {
  return `report:${reportId}`;
}

export const REPORT_UPDATED_EVENT = 'updated';
