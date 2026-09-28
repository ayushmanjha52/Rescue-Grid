"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PhonePromptModal from "./PhonePromptModal";
import { rememberReport } from "@/lib/myReportsStorage";
import { SOS_SMS_NUMBER, STORAGE_KEYS } from "@/lib/config";
import { readStoredValue, useStoredValue, writeStoredValue } from "@/hooks/useStoredValue";

interface SOSSMSButtonProps {
  situationType: string;
  customMessage?: string;
  phoneNumber?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  stale?: boolean;
}

const SITUATION_LABELS: Record<string, string> = {
  food: "Food",
  water: "Water",
  medical: "Medical",
  rescue: "Rescue",
  shelter: "Shelter",
  missing: "Missing",
};

function readLastKnownLocation(): LocationData | null {
  try {
    const raw = readStoredValue(STORAGE_KEYS.lastLocation);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") return null;
    return { latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy ?? null, stale: true };
  } catch {
    return null;
  }
}

export function rememberLocation(location: { latitude: number; longitude: number; accuracy?: number | null }) {
  writeStoredValue(
    STORAGE_KEYS.lastLocation,
    JSON.stringify({ ...location, savedAt: new Date().toISOString() })
  );
}

/** Builds the SMS body parsed by the twilio-sms-webhook edge function. */
export function buildSOSMessage(phone: string, situationType: string, location: LocationData | null, customMessage?: string) {
  const lines = ["RESCUEGRID SOS", `Phone: ${phone}`];
  if (location) {
    lines.push(`Location: ${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`);
    if (location.accuracy != null) {
      const quality = location.accuracy < 50 ? "High" : location.accuracy < 200 ? "Medium" : "Low";
      lines.push(`Accuracy: ${quality} (~${Math.round(location.accuracy)}m)${location.stale ? " (last known)" : ""}`);
    }
  } else {
    lines.push("Location: unknown");
  }
  lines.push(`Type: ${situationType}`);
  lines.push(`Msg: ${customMessage?.trim() || "None"}`);
  return lines.join("\n");
}

export function openSMSComposer(body: string) {
  // "?&body=" is understood by both Android and iOS messaging apps.
  window.location.href = `sms:${SOS_SMS_NUMBER}?&body=${encodeURIComponent(body)}`;
}

export function useSOSSMS() {
  const [isLoading, setIsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const getLocation = useCallback((): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(readLastKnownLocation());
        return;
      }

      setGpsStatus("Getting location...");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          rememberLocation(location);
          resolve(location);
        },
        // In an emergency never block the SMS on GPS — fall back to the last fix.
        () => resolve(readLastKnownLocation()),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  const openSMSApp = useCallback(
    async (phone: string, situationType: string, customMessage?: string) => {
      setIsLoading(true);
      setNotice(null);

      const location = await getLocation();
      if (!location) {
        setNotice("Could not get GPS. The SMS will be sent without a location — please add your landmark in the message.");
      } else if (location.stale) {
        setNotice("Live GPS unavailable — your last known location was used.");
      }

      openSMSComposer(buildSOSMessage(phone, situationType, location, customMessage));

      setTimeout(() => {
        setIsLoading(false);
        setGpsStatus(null);
      }, 1000);
    },
    [getLocation]
  );

  /**
   * Sends the SOS straight to the response team over the internet (with GPS
   * and the typed details). Returns the report id, or null when it couldn't be
   * sent online. The caller then falls back to SMS.
   */
  const sendOnline = useCallback(
    async (phone: string, situationType: string, customMessage?: string): Promise<{ id: string } | { error: string } | null> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return null;
      setIsLoading(true);
      setNotice(null);
      const location = await getLocation();
      setGpsStatus("Sending SOS...");
      try {
        const res = await fetch("/api/victim/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_no: phone,
            situation: situationType,
            custom_message: customMessage || null,
            ...(location ? { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.id) return { id: data.id };
        // Missing location: tell them what to add instead of silently switching to SMS.
        if (res.status === 400) return { error: data.error || "Could not send the SOS" };
        return null;
      } catch {
        return null;
      } finally {
        setIsLoading(false);
        setGpsStatus(null);
      }
    },
    [getLocation]
  );

  return {
    openSMSApp,
    sendOnline,
    isLoading,
    gpsStatus,
    notice,
    clearNotice: () => setNotice(null),
  };
}

export default function SOSSMSButton({
  situationType,
  customMessage,
  phoneNumber,
}: SOSSMSButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState("");
  const [storedPhone] = useStoredValue(STORAGE_KEYS.victimPhone);
  const { openSMSApp, sendOnline, isLoading, gpsStatus, notice } = useSOSSMS();

  // Online: the SOS goes straight to the DMA dashboard. Offline (or if the
  // server can't be reached): the phone's SMS app opens as a backup.
  const handleModalSubmit = async (submittedPhone: string, details: string) => {
    setModalError("");
    const text = details || customMessage;
    const result = await sendOnline(submittedPhone, situationType, text);
    if (result && "id" in result) {
      setShowModal(false);
      rememberReport(result.id);
      router.push(`/report/status/${result.id}`);
      return;
    }
    if (result && "error" in result) {
      setModalError(result.error);
      return;
    }
    setShowModal(false);
    void openSMSApp(submittedPhone, situationType, text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isLoading}
        className="w-full text-center font-display font-bold text-lg uppercase tracking-[0.15em] text-white bg-red-500 py-4 px-4 transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm shadow-lg shadow-red-500/30 animate-attention-bounce"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {gpsStatus || "Getting Location..."}
          </>
        ) : (
          <>
            <span aria-hidden="true">🚨</span>
            SOS · Send alert now ({SITUATION_LABELS[situationType] || situationType})
          </>
        )}
      </button>

      {showModal && (
        <PhonePromptModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleModalSubmit}
          situationType={situationType}
          initialPhone={phoneNumber || storedPhone || ""}
          submitError={modalError}
          busy={isLoading}
        />
      )}

      {notice && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-sm" role="status">
          <p className="font-mono text-xs text-amber-700 text-center">{notice}</p>
        </div>
      )}
    </>
  );
}
