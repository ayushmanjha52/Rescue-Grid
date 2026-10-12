"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ClipboardList, Droplets, HandHeart, HeartPulse, House, LifeBuoy, Phone, ShieldCheck, UserSearch, Utensils, WifiOff } from "lucide-react";
import SOSSMSButton from "@/components/victim/SOSSMSButton";
import HelplineLink from "@/components/victim/HelplineLink";
import Wordmark from "@/components/ui/Wordmark";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { HELPLINE_NUMBER } from "@/lib/config";
import { SITUATION_COLORS, type Situation } from "@/lib/status";

type SituationCard = {
  type: Situation;
  label: string;
  labelHindi: string;
  Icon: LucideIcon;
};

const situations: SituationCard[] = [
  { type: "food", label: "Food", labelHindi: "भोजन", Icon: Utensils },
  { type: "water", label: "Water", labelHindi: "पानी", Icon: Droplets },
  { type: "medical", label: "Medical", labelHindi: "चिकित्सा", Icon: HeartPulse },
  { type: "rescue", label: "Rescue", labelHindi: "बचाव", Icon: LifeBuoy },
  { type: "shelter", label: "Shelter", labelHindi: "आश्रय", Icon: House },
  { type: "missing", label: "Missing", labelHindi: "लापता", Icon: UserSearch },
];

export default function VictimHomePage() {
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen ember-glow flex flex-col">
      <main className="flex-1 px-4 pt-10 pb-28">
        <div className="max-w-md mx-auto">
          <header className="text-center mb-8">
            <h1 className="mb-4">
              <Wordmark size="xl" />
            </h1>
            <p className="font-serif italic text-[22px] leading-snug text-muted">
              Help, the moment it&apos;s needed.
            </p>
            <p className="mt-1 font-body text-[14px] text-dim">
              Report an emergency · आपातकाल रिपोर्ट करें
            </p>
          </header>

          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 bg-alert/10 text-alert font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-1.5 rounded-full border border-alert/25">
              <span className="w-1.5 h-1.5 rounded-full bg-alert animate-pulse" aria-hidden="true" />
              SOS works without internet (needs mobile signal)
            </span>
          </div>

          {!isOnline && (
            <div className="mb-4 p-3 bg-orange/10 border border-orange/25 text-center rounded-lg" role="status">
              <p className="font-mono text-[11px] text-orange leading-relaxed">
                <WifiOff className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />
                No internet — use the SOS button below to send an emergency SMS
                <br />
                इंटरनेट नहीं है — नीचे SOS बटन से SMS भेजें
              </p>
            </div>
          )}

          <SOSSMSButton situationType="rescue" />

          <div className="mt-8 mb-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-linear-to-r from-transparent to-white/10" />
            <span className="font-mono text-[11px] text-dim uppercase tracking-[0.2em]">or choose what you need</span>
            <div className="flex-1 h-px bg-linear-to-l from-transparent to-white/10" />
          </div>

          <h2 className="sr-only">What do you need? / आपको क्या चाहिए?</h2>

          <div className="grid grid-cols-2 gap-3">
            {situations.map(({ type, label, labelHindi, Icon }) => {
              const color = SITUATION_COLORS[type];
              return (
                <Link
                  key={type}
                  href={`/report/${type}`}
                  className="group relative overflow-hidden bg-surface-1 p-4 text-left rounded-xl border border-border-dim transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-surface-2 active:scale-[0.98]"
                >
                  <span
                    className="absolute inset-x-0 top-0 h-px opacity-60 transition-opacity group-hover:opacity-100"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                    aria-hidden="true"
                  />
                  <span
                    className="mb-3 inline-flex w-10 h-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${color}1A`, color }}
                    aria-hidden="true"
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <div className="font-display text-[17px] font-semibold text-ink leading-tight">{label}</div>
                  <div className="font-body text-[13px] text-dim leading-normal">{labelHindi}</div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/report/my"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-dim uppercase tracking-[0.14em] hover:text-orange transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
              My Reports / मेरी रिपोर्ट
            </Link>
          </div>

          <Link
            href="/volunteer/login?join=1"
            className="group mt-6 flex items-center gap-3 p-4 bg-ops/[0.07] border border-ops/20 rounded-xl hover:bg-ops/10 hover:border-ops/35 transition-colors"
          >
            <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-ops/15 text-ops" aria-hidden="true">
              <HandHeart className="w-5 h-5" strokeWidth={1.75} />
            </span>
            <span className="flex-1">
              <span className="block font-display text-[15px] font-semibold text-ink">
                Safe and able to help? Join as a volunteer
              </span>
              <span className="block font-body text-[13px] text-muted">
                सुरक्षित हैं और मदद कर सकते हैं? स्वयंसेवक बनें
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-ops transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          <p className="mt-10 text-center">
            <Link
              href="/dma/login"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-dim uppercase tracking-[0.14em] hover:text-orange transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Disaster management (DMA) team login
            </Link>
          </p>
        </div>
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-void/80 backdrop-blur-md border-t border-border-dim"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <HelplineLink className="mx-auto max-w-md flex items-center justify-center gap-2 w-full font-mono font-semibold text-[13px] uppercase tracking-[0.15em] text-on-accent bg-orange py-3.5 px-6 transition-opacity hover:opacity-90 active:scale-[0.98] rounded-lg">
          <Phone className="w-4 h-4" aria-hidden="true" />
          Helpline: {HELPLINE_NUMBER}
        </HelplineLink>
      </div>
    </div>
  );
}
