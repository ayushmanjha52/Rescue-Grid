import type { Metadata } from "next";
import type { ReactNode } from "react";

// Per-report links are private: keep them out of search engines and don't
// leak the URL to other sites.
export const metadata: Metadata = {
  title: "Report status",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ReportStatusLayout({ children }: { children: ReactNode }) {
  return children;
}
