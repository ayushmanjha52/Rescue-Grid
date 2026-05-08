"use client";

import { useState, useEffect } from "react";

interface PhonePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (phone: string) => void;
  situationType: string;
}

export default function PhonePromptModal({
  isOpen,
  onClose,
  onSubmit,
  situationType,
}: PhonePromptModalProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("victim_phone");
    if (saved) setPhone(saved);
  }, []);

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setLocationError("Please enter your phone number");
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by this browser");
      return;
    }

    setIsGettingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        localStorage.setItem("victim_phone", phone.trim());

        setIsGettingLocation(false);
        onSubmit(phone.trim());
      },
      (err) => {
        setIsGettingLocation(false);
        setLocationError(`Location error: ${err.message}. Please enable location services.`);
      }
    );
  };

  if (!isOpen) return null;

  const situationLabels: Record<string, string> = {
    food: "Food Emergency",
    water: "Water Emergency",
    medical: "Medical Emergency",
    rescue: "Rescue Required",
    shelter: "Shelter Needed",
    missing: "Missing Person",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-2 border border-border-dim shadow-2xl">
        <div className="p-4 border-b border-border-dim">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <span className="font-display text-lg font-bold text-ink uppercase tracking-wide">
                SOS Alert
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 font-body text-sm text-muted">
            Send emergency SMS to {situationLabels[situationType] || situationType}
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
              Your Phone Number *
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXXXXXXX"
              className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors"
            />
            <p className="font-mono text-[10px] text-dim mt-1">
              Rescue team may call this number
            </p>
          </div>

          <div>
            <label className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">
              Additional Details (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 160))}
              placeholder="e.g., 6 people stuck, water rising..."
              rows={2}
              className="w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-2 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4 focus:border-orange transition-colors resize-none"
            />
            <span className="font-mono text-[10px] text-dim">{message.length}/160</span>
          </div>

          {locationError && (
            <div className="p-3 bg-alert/10 border border-alert/30">
              <p className="font-mono text-[11px] text-alert">{locationError}</p>
            </div>
          )}

          <div className="p-3 bg-surface-3 border border-border-dim">
            <p className="font-mono text-[10px] text-muted mb-2">How it works:</p>
            <ul className="space-y-1 font-body text-[11px] text-dim">
              <li>1. Tap button below</li>
              <li>2. SMS app opens with your location</li>
              <li>3. Just press send</li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-border-dim">
          <button
            onClick={handleSubmit}
            disabled={isGettingLocation}
            className="w-full text-center font-display font-bold text-[13px] uppercase tracking-[0.15em] text-white bg-alert py-3 px-6 transition-all hover:bg-alert/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
            }}
          >
            {isGettingLocation ? (
              <>
                <svg
                  className="animate-spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Getting Location...
              </>
            ) : (
              <>
                <span className="text-lg">📱</span>
                Open SMS App
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
