const STORAGE_KEY = "rescuegrid_reports";

export type StoredReport = {
  id: string;
  phone: string;
  situation: string;
  createdAt: string;
};

export function addReport(phone: string, id: string, situation: string) {
  const existing = getReports();
  const report: StoredReport = {
    id,
    phone,
    situation,
    createdAt: new Date().toISOString(),
  };
  const updated = [report, ...existing.filter((r) => r.id !== id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function getReports(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearReports() {
  localStorage.removeItem(STORAGE_KEY);
}
