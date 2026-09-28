import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Volunteer",
  robots: { index: false, follow: false },
};

export default function VolunteerSectionLayout({ children }: { children: ReactNode }) {
  return children;
}
