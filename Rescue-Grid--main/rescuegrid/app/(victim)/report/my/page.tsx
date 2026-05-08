"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SITUATION_COLORS: Record<string, string> = {
  food: "#2ECC71",
  water: "#3B8BFF",
  medical: "#F5A623",
  rescue: "#FF3B3B",
  shelter: "#A855F7",
  missing: "#6B7280",
};

type Report = {
  id: string;
  phone_no: string;
  latitude: number;
  longitude: number;
  city: string | null;
  district: string | null;
  situation: string;
  custom_message: string | null;
  urgency: string;
  status: string;
  created_at: string;
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CACHE_KEY = "rescuegrid_my_reports";

export default function MyReportsPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { phone: cachedPhone, reports: cachedReports } = JSON.parse(cached);
        setPhone(cachedPhone);
        setReports(cachedReports);
        setSearched(true);
      } catch {
        sessionStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  const searchReports = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/victim/reports?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch reports");
        setReports([]);
      } else {
        const fetchedReports = data.reports || [];
        setReports(fetchedReports);
        setSearched(true);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          phone: phone.trim(),
          reports: fetchedReports
        }));
      }
    } catch {
      setError("Network error — please try again");
      setReports([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-dim">
        <button
          onClick={() => router.push("/")}
          className="text-muted hover:text-orange transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-display text-lg font-semibold text-ink uppercase tracking-wide">
          My Reports
        </span>
      </div>

      <div className="flex-1 px-4 py-4 pb-24 space-y-4">
        <div>
          <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
            Enter Your Phone Number
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchReports()}
              placeholder="+91 XXXXXXXXXX"
              className="flex-1 px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors"
            />
            <button
              onClick={searchReports}
              disabled={!phone.trim() || loading}
              className="font-display font-semibold text-[11px] uppercase tracking-[0.1em] text-black bg-orange px-4 py-2 disabled:opacity-50"
              style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)" }}
            >
              {loading ? "..." : "Find"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-alert font-mono text-[11px]">{error}</p>
        )}

        {!loading && searched && reports.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-[11px] text-dim uppercase tracking-widest mb-2">
              No reports found for {phone}
            </p>
            <p className="font-body text-[13px] text-dim">
              Submit a report from the home screen first
            </p>
          </div>
        )}

        {!searched && (
          <div className="text-center py-12">
            <p className="font-mono text-[11px] text-dim uppercase tracking-widest mb-2">
              Enter your phone number
            </p>
            <p className="font-body text-[13px] text-dim">
              to view your submitted reports
            </p>
          </div>
        )}

        {reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => {
              const borderColor = SITUATION_COLORS[report.situation] || "#FF6B2B";

              return (
                <button
                  key={report.id}
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
                        {report.status}
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
              );
            })}
          </div>
        )}

        {reports.length > 0 && (
          <p className="font-mono text-[10px] text-dim text-center mt-2">
            {reports.length} report{reports.length !== 1 ? "s" : ""} found
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-void border-t border-border-dim">
        <button
          onClick={() => router.push("/")}
          className="w-full text-center font-display font-semibold text-[13px] uppercase tracking-[0.15em] text-black bg-orange py-3 transition-opacity hover:opacity-90"
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
