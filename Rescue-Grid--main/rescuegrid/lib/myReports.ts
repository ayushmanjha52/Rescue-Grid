// Victims have no account. The reports they sent from this device are
// remembered by id (an unguessable UUID) in localStorage, and "My Reports"
// looks up only those ids. A phone-number lookup would let anyone who knows
// someone's number find their reports and location.
//
// Pure helpers, shared by the server and the browser. The localStorage writer
// is in lib/myReportsStorage.ts.

export const MAX_REMEMBERED_REPORTS = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReportId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Parses the stored list, dropping anything that isn't a report id. */
export function parseReportIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set(parsed.filter(isReportId))].slice(0, MAX_REMEMBERED_REPORTS) : [];
  } catch {
    return [];
  }
}

/** Newest first, de-duplicated and capped. */
export function addReportId(ids: string[], id: string): string[] {
  if (!isReportId(id)) return ids;
  return [id, ...ids.filter((existing) => existing !== id)].slice(0, MAX_REMEMBERED_REPORTS);
}

/** Accepts a bare report id or a pasted status link (…/report/status/<id>). */
export function extractReportId(input: string): string | null {
  const match = input.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0].toLowerCase() : null;
}
