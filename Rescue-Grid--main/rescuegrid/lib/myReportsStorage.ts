'use client';

import { STORAGE_KEYS } from "@/lib/config";
import { readStoredValue, writeStoredValue } from "@/hooks/useStoredValue";
import { addReportId, parseReportIds } from "@/lib/myReports";

/** Remembers a report on this device so it shows up in "My Reports". */
export function rememberReport(id: string) {
  const ids = parseReportIds(readStoredValue(STORAGE_KEYS.myReports));
  const next = addReportId(ids, id);
  if (next !== ids) writeStoredValue(STORAGE_KEYS.myReports, JSON.stringify(next));
}

export function forgetReport(id: string) {
  const ids = parseReportIds(readStoredValue(STORAGE_KEYS.myReports));
  writeStoredValue(STORAGE_KEYS.myReports, JSON.stringify(ids.filter((existing) => existing !== id)));
}
