import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Join as a volunteer",
  description:
    "Safe and able to help in an emergency? Sign up with your phone number, add your skills, and the disaster-response team can send you missions.",
  robots: { index: true, follow: true },
};

export default function VolunteerLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
