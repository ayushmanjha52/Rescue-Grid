"use client";

import Link from "next/link";
import SOSSMSButton from "@/components/victim/SOSSMSButton";
import HelplineLink from "@/components/victim/HelplineLink";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { HELPLINE_NUMBER } from "@/lib/config";
import type { Situation } from "@/lib/status";

type SituationCard = {
  type: Situation;
  label: string;
  labelHindi: string;
  icon: string;
  borderColor: string;
};

const situations: SituationCard[] = [
  { type: "food", label: "Food", labelHindi: "भोजन", icon: "🍱", borderColor: "#1E8449" },
  { type: "water", label: "Water", labelHindi: "पानी", icon: "💧", borderColor: "#1F5FCC" },
  { type: "medical", label: "Medical", labelHindi: "चिकित्सा", icon: "🏥", borderColor: "#B45309" },
  { type: "rescue", label: "Rescue", labelHindi: "बचाव", icon: "🆘", borderColor: "#D32F2F" },
  { type: "shelter", label: "Shelter", labelHindi: "आश्रय", icon: "🏠", borderColor: "#7E22CE" },
  { type: "missing", label: "Missing", labelHindi: "लापता", icon: "👤", borderColor: "#4B5563" },
];

export default function VictimHomePage() {
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 px-4 pt-6 pb-24">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="inline-flex items-center gap-0 mb-2">
              <span className="font-[family-name:var(--font-inter)] text-[32px] font-bold tracking-[0.1em] text-gray-900">
                RESCUE
              </span>
              <span className="font-[family-name:var(--font-inter)] text-[32px] font-bold tracking-[0.1em] text-orange">
                GRID
              </span>
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-[15px] text-gray-500 leading-[1.5]">
              Report Emergency / आपातकाल रिपोर्ट करें
            </p>
          </div>

          <div className="text-center mb-4">
            <span className="inline-block bg-red-50 text-red-600 font-[family-name:var(--font-ibm-mono)] text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border border-red-100">
              🚨 SOS works without internet (needs mobile signal)
            </span>
          </div>

          {!isOnline && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-100 text-center rounded-sm" role="status">
              <p className="font-[family-name:var(--font-ibm-mono)] text-[11px] text-orange-700">
                📡 No internet — use the SOS button below to send an emergency SMS
                <br />
                इंटरनेट नहीं है — नीचे SOS बटन से SMS भेजें
              </p>
            </div>
          )}

          <SOSSMSButton situationType="rescue" />

          <div className="mt-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="font-[family-name:var(--font-ibm-mono)] text-[11px] text-gray-500 uppercase tracking-wider">or select type</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </div>

          <h2 className="text-center font-[family-name:var(--font-inter)] text-[15px] font-semibold text-gray-900 mb-4 tracking-wide leading-[1.3]">
            What do you need? / आपको क्या चाहिए?
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {situations.map((situation) => (
              <Link
                key={situation.type}
                href={`/report/${situation.type}`}
                className="relative bg-gray-50 p-4 text-left transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] border border-gray-100 rounded-sm"
                style={{ borderLeft: `3px solid ${situation.borderColor}` }}
              >
                <div className="text-3xl mb-2" aria-hidden="true">{situation.icon}</div>
                <div className="font-[family-name:var(--font-inter)] text-[15px] font-semibold uppercase tracking-[0.05em] text-gray-900 mb-0.5">
                  {situation.label}
                </div>
                <div className="font-[family-name:var(--font-inter)] text-[13px] text-gray-500 leading-[1.5]">
                  {situation.labelHindi}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/report/my"
              className="font-[family-name:var(--font-ibm-mono)] text-[11px] text-gray-500 uppercase tracking-[0.1em] hover:text-orange transition-colors"
            >
              📋 My Reports / मेरी रिपोर्ट
            </Link>
          </div>

          <Link
            href="/volunteer/login?join=1"
            className="mt-6 flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-sm hover:bg-green-100 transition-colors"
          >
            <span className="text-3xl" aria-hidden="true">🙋</span>
            <span className="flex-1">
              <span className="block font-[family-name:var(--font-inter)] text-[15px] font-semibold text-gray-900">
                Safe and able to help? Join as a volunteer
              </span>
              <span className="block font-[family-name:var(--font-inter)] text-[13px] text-gray-600">
                सुरक्षित हैं और मदद कर सकते हैं? स्वयंसेवक बनें
              </span>
            </span>
            <span className="font-[family-name:var(--font-ibm-mono)] text-[13px] text-green-700" aria-hidden="true">→</span>
          </Link>

          <p className="mt-8 text-center">
            <Link
              href="/dma/login"
              className="font-[family-name:var(--font-ibm-mono)] text-[11px] text-gray-600 uppercase tracking-[0.1em] underline hover:text-orange"
            >
              Disaster management (DMA) team login
            </Link>
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <HelplineLink className="block w-full text-center font-[family-name:var(--font-ibm-mono)] font-medium text-[13px] uppercase tracking-[0.15em] text-white bg-orange py-3.5 px-6 transition-opacity hover:opacity-90 active:scale-[0.98] rounded-sm">
          📞 Helpline: {HELPLINE_NUMBER}
        </HelplineLink>
      </div>
    </div>
  );
}
