"use client";

import { useState } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { STORAGE_KEYS } from "@/lib/config";
import { writeStoredValue } from "@/hooks/useStoredValue";

interface PhonePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (phone: string, details: string) => void;
  /** Error from sending (e.g. no location), shown in the form. */
  submitError?: string;
  busy?: boolean;
  situationType: string;
  initialPhone?: string;
}

const SITUATION_LABELS: Record<string, string> = {
  food: "Food Emergency",
  water: "Water Emergency",
  medical: "Medical Emergency",
  rescue: "Rescue Required",
  shelter: "Shelter Needed",
  missing: "Missing Person",
};

const SMS_DETAILS_LIMIT = 300;

export default function PhonePromptModal({
  isOpen,
  onClose,
  onSubmit,
  situationType,
  initialPhone = "",
  submitError = "",
  busy = false,
}: PhonePromptModalProps) {
  useEscapeKey(onClose, isOpen);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter your 10-digit phone number");
      return;
    }

    writeStoredValue(STORAGE_KEYS.victimPhone, phone.trim());
    onSubmit(phone.trim(), message.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-modal-title"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-surface-2 border border-border-dim shadow-2xl">
        <div className="p-4 border-b border-border-dim">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">🚨</span>
              <span id="sos-modal-title" className="font-display text-lg font-bold text-ink uppercase tracking-wide">
                SOS Alert
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 font-body text-sm text-muted">
            {SITUATION_LABELS[situationType] || situationType}: your location and details go straight to the rescue team.
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="sos-phone" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
              Your Phone Number *
            </label>
            <input
              id="sos-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError("");
              }}
              placeholder="+91 XXXXXXXXXX"
              className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors"
            />
            <p className="font-mono text-[10px] text-dim mt-1">
              Rescue team may call this number
            </p>
          </div>

          <div>
            <label htmlFor="sos-details" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
              Additional Details (optional)
            </label>
            <textarea
              id="sos-details"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, SMS_DETAILS_LIMIT))}
              placeholder="e.g., 6 people stuck, water rising, near temple..."
              rows={2}
              className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors resize-none"
            />
            <span className="font-mono text-[10px] text-dim">{message.length}/{SMS_DETAILS_LIMIT}</span>
          </div>

          {(error || submitError) && (
            <div className="p-3 bg-alert/10 border border-alert/30" role="alert">
              <p className="font-mono text-[11px] text-alert">{error || submitError}</p>
            </div>
          )}

          <div className="p-3 bg-surface-3 border border-border-dim">
            <p className="font-mono text-[10px] text-muted mb-2">How it works:</p>
            <ol className="space-y-1 font-body text-[11px] text-dim">
              <li>1. Tap the button below: your GPS location, number and details reach the rescue team at once</li>
              <li>2. No internet? Your SMS app opens with everything filled in</li>
              <li>3. Then just press send. SMS needs only mobile signal</li>
            </ol>
            <p className="mt-2 font-body text-[11px] text-muted">
              Your number and location go only to the emergency-response team.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border-dim">
          <button
            type="submit"
            disabled={busy}
            className="w-full text-center font-display font-bold text-[13px] uppercase tracking-[0.15em] text-white bg-alert py-3 px-6 transition-all hover:bg-alert/90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 clip-path-tactical"
          >
            <span className="text-lg" aria-hidden="true">🚨</span>
            {busy ? "Sending…" : "Send SOS now"}
          </button>
        </div>
      </form>
    </div>
  );
}
