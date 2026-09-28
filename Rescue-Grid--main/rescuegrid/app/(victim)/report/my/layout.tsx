import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My reports",
  robots: { index: false, follow: false },
};

export default function MyReportsLayout({ children }: { children: ReactNode }) {
  return children;
}
