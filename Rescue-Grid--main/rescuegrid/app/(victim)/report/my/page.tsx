"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HELPLINE_NUMBER, STORAGE_KEYS } from "@/lib/config";
import { useStoredValue } from "@/hooks/useStoredValue";
import { extractReportId, parseReportIds } from "@/lib/myReports";
import { forgetReport } from "@/lib/myReportsStorage";

const SITUATION_COLORS: Record<string, string> = {
  food: "#1E8449",
  water: "#1F5FCC",
  medical: "#B45309",
  rescue: "#D32F2F",
  shelter: "#7E22CE",
  missing: "#4B5563",
};

type Report = {
  id: string;
  city: string | null;
  district: string | null;
  situation: string;
  custom_message: string | null;
  urgency: string;
  status: string;
  created_at: string;
};

type LookupResult = { key: string; reports: Report[]; error: string };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyReportsPage() {
  const router = useRouter();

  // Reports sent from (or opened on) this device.
  const [storedIds] = useStoredValue(STORAGE_KEYS.myReports);
  const idsKey = useMemo(() => parseReportIds(storedIds).join(","), [storedIds]);

  const [result, setResult] = useState<LookupResult | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    fetch("/api/victim/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: idsKey.split(",") }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setResult({
          key: idsKey,
          reports: res.ok && Array.isArray(data.reports) ? data.reports : [],
          error: res.ok ? "" : data.error || "Failed to load your reports",
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: idsKey, reports: [], error: "Network error — check your connection and try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const loading = !!idsKey && result?.key !== idsKey;
  const reports = idsKey && result?.key === idsKey ? result.reports : [];
  const error = result?.key === idsKey ? result.error : "";

  const openLink = () => {
    const id = extractReportId(linkInput);
    if (!id) {
      setLinkError("That doesn't look like a report link. It ends with a long code like 3f2a…-….");
      return;
    }
    router.push(`/report/status/${id}`);
  };

  return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-dim">
        <button
          onClick={() => router.push("/")}
          className="text-muted hover:text-orange transition-colors"
          aria-label="Back to home"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display text-lg font-semibold text-ink uppercase tracking-wide">
          My Reports
        </h1>
      </div>

      <div className="flex-1 px-4 py-4 pb-24 space-y-4">
        <p className="font-body text-[13px] text-muted">
          Reports sent from this phone appear here automatically. / इस फ़ोन से भेजी गई रिपोर्ट यहाँ दिखती हैं।
        </p>

        {error && (
          <p className="text-alert font-mono text-[11px]" role="alert">{error}</p>
        )}

        {loading && (
          <p className="font-mono text-[11px] text-dim text-center py-8" role="status">Loading your reports…</p>
        )}

        {!loading && reports.length === 0 && !error && (
          <div className="text-center py-10">
            <p className="font-mono text-[11px] text-dim uppercase tracking-widest mb-2">No reports on this device</p>
            <p className="font-body text-[13px] text-dim">
              Sent a report from another phone or by SMS? Open the link from the SMS reply below, or call{" "}
              <a href={`tel:${HELPLINE_NUMBER}`} className="text-orange underline">{HELPLINE_NUMBER}</a>.
            </p>
          </div>
        )}

        {reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => {
              const borderColor = SITUATION_COLORS[report.situation] || "#C44A12";

              return (
                <div key={report.id}>
                <button
                  onClick={() => router.push(`/report/status/${report.id}`)}
                  className="w-full text-left bg-surface-2 p-4 border-l-2 transition-opacity hover:opacity-80"
                  style={{
                    borderLeftColor: borderColor,
                    clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="font-mono text-[10px] uppercase px-1.5 py-0.5"
                      style={{ backgroundColor: `${borderColor}22`, color: borderColor }}
                    >
                      {report.situation}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] uppercase px-1.5 py-0.5 ${
                          report.urgency === "critical"
                            ? "bg-alert/20 text-alert"
                            : report.urgency === "urgent"
                            ? "bg-orange/20 text-orange"
                            : "bg-intel/20 text-intel"
                        }`}
                      >
                        {report.urgency}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase px-1.5 py-0.5 ${
                          report.status === "open"
                            ? "bg-intel/20 text-intel"
                            : report.status === "resolved"
                            ? "bg-ops/20 text-ops"
                            : "bg-orange/20 text-orange"
                        }`}
                      >
                        {report.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  {report.city && (
                    <p className="font-body text-[12px] text-muted mb-1">
                      📍 {report.city}{report.district ? `, ${report.district}` : ""}
                    </p>
                  )}
                  {report.custom_message && (
                    <p className="font-body text-[12px] text-ink truncate mb-1">
                      {report.custom_message}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-dim">
                    {formatDate(report.created_at)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remove this report from this phone? It stays with the response team.")) forgetReport(report.id);
                  }}
                  className="mt-1 font-mono text-[10px] text-dim underline hover:text-alert"
                >
                  Remove from this device
                </button>
                </div>
              );
            })}
          </div>
        )}

        {reports.length > 0 && (
          <p className="font-mono text-[10px] text-dim text-center mt-2">
            {reports.length} report{reports.length !== 1 ? "s" : ""} on this device
          </p>
        )}

        <form
          className="pt-4 border-t border-border-dim"
          onSubmit={(e) => {
            e.preventDefault();
            openLink();
          }}
        >
          <label htmlFor="report-link" className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] block mb-1">
            Open a report link
          </label>
          <div className="flex gap-2">
            <input
              id="report-link"
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setLinkError("");
              }}
              placeholder="Paste the link from your SMS"
              className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors"
            />
            <button
              type="submit"
              disabled={!linkInput.trim()}
              className="font-display font-semibold text-[11px] uppercase tracking-[0.1em] text-white bg-orange px-4 py-2 disabled:opacity-50"
            >
              Open
            </button>
          </div>
          {linkError && <p className="mt-1 text-alert font-mono text-[11px]" role="alert">{linkError}</p>}
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-void border-t border-border-dim">
        <button
          onClick={() => router.push("/")}
          className="w-full text-center font-display font-semibold text-[13px] uppercase tracking-[0.15em] text-white bg-orange py-3 transition-opacity hover:opacity-90"
          style={{
            clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
          }}
        >
          + New Report
        </button>
      </div>
    </div>
  );
}
