"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SOSSMSButton from "@/components/victim/SOSSMSButton";

type Situation = {
  type: "food" | "water" | "medical" | "rescue" | "shelter" | "missing";
  label: string;
  labelHindi: string;
  icon: string;
  borderColor: string;
};

const situations: Situation[] = [
  { type: "food", label: "Food", labelHindi: "भोजन", icon: "🍱", borderColor: "#2ECC71" },
  { type: "water", label: "Water", labelHindi: "पानी", icon: "💧", borderColor: "#3B8BFF" },
  { type: "medical", label: "Medical", labelHindi: "चिकित्सा", icon: "🏥", borderColor: "#F5A623" },
  { type: "rescue", label: "Rescue", labelHindi: "बचाव", icon: "🆘", borderColor: "#FF3B3B" },
  { type: "shelter", label: "Shelter", labelHindi: "आश्रय", icon: "🏠", borderColor: "#A855F7" },
  { type: "missing", label: "Missing", labelHindi: "लापता", icon: "👤", borderColor: "#6B7280" },
];

export default function VictimHomePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex-1 px-4 pt-6 pb-24">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-0 mb-2">
              <span className="font-[family-name:var(--font-inter)] text-[32px] font-bold tracking-[0.1em] text-ink">
                RESCUE
              </span>
              <span className="font-[family-name:var(--font-inter)] text-[32px] font-bold tracking-[0.1em] text-orange">
                GRID
              </span>
            </div>
            <p className="font-[family-name:var(--font-inter)] text-sm text-muted leading-[1.5]">
              Report Emergency / आपातकाल रिपोर्ट करें
            </p>
          </div>

          <div className="text-center mb-4">
            <span className="inline-block bg-alert text-white font-[family-name:var(--font-ibm-mono)] text-[10px] uppercase tracking-[0.15em] px-2 py-0.5">
              🚨 SOS - Works Without Internet
            </span>
          </div>

          {!isOnline && (
            <div className="mb-4 p-2 bg-surface-2 border border-orange/30 text-center">
              <p className="font-[family-name:var(--font-ibm-mono)] text-[10px] text-orange">
                📡 Offline Mode - Use SOS button below to send emergency SMS
              </p>
            </div>
          )}

          <SOSSMSButton situationType="rescue" />

          <div className="mt-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border-dim" />
              <span className="font-[family-name:var(--font-ibm-mono)] text-[10px] text-dim uppercase tracking-wider">or select type</span>
              <div className="flex-1 h-px bg-border-dim" />
            </div>
          </div>

          <p className="text-center font-[family-name:var(--font-inter)] text-[15px] font-semibold text-ink mb-4 tracking-wide leading-[1.3]">
            What do you need?
          </p>

          <div className="grid grid-cols-2 gap-3">
            {situations.map((situation) => (
              <button
                key={situation.type}
                onClick={() => router.push(`/report/${situation.type}`)}
                className="relative bg-surface-2 p-4 text-left transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                style={{
                  clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                  borderLeft: `3px solid ${situation.borderColor}`,
                }}
              >
                <div
                  className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{
                    clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                  }}
                />
                <div className="text-3xl mb-2">{situation.icon}</div>
                <div className="font-[family-name:var(--font-inter)] text-[15px] font-semibold uppercase tracking-[0.05em] text-ink mb-0.5">
                  {situation.label}
                </div>
                <div className="font-[family-name:var(--font-inter)] text-[13px] text-muted leading-[1.5]">
                  {situation.labelHindi}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/report/my")}
              className="font-[family-name:var(--font-ibm-mono)] text-[11px] text-muted uppercase tracking-[0.1em] hover:text-orange transition-colors"
            >
              📋 My Reports / मेरी रिपोर्ट
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-void border-t border-border-dim">
        <a
          href={`tel:${process.env.NEXT_PUBLIC_TWILIO_SMS_NUMBER}`}
          className="block w-full text-center font-[family-name:var(--font-ibm-mono)] font-medium text-[13px] uppercase tracking-[0.15em] text-black bg-orange py-3 px-6 transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
          }}
        >
          📞 Helpline: {process.env.NEXT_PUBLIC_TWILIO_SMS_NUMBER}
        </a>
      </div>
    </div>
  );
}
