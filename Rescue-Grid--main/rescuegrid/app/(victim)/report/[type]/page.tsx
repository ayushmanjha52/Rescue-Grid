import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportForm from "@/components/victim/ReportForm";
import { isSituation, SITUATIONS, type Situation } from "@/lib/status";

const TITLES: Record<Situation, string> = {
  food: "Request food",
  water: "Request drinking water",
  medical: "Request medical help",
  rescue: "Request rescue",
  shelter: "Request shelter",
  missing: "Report a missing person",
};

export function generateStaticParams() {
  return SITUATIONS.map((type) => ({ type }));
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  if (!isSituation(type)) return {};
  return {
    title: TITLES[type],
    description: `${TITLES[type]} from the disaster-response team. Share your location and details; responders can see and act on it immediately.`,
  };
}

export default async function ReportTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isSituation(type)) notFound();
  return <ReportForm type={type} />;
}
