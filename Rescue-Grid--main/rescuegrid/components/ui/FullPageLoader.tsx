"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

interface FullPageLoaderProps {
  message?: string;
  showBranding?: boolean;
  className?: string;
}

const defaultMessages = [
  "Loading...",
  "Preparing your workspace...",
  "Fetching data...",
  "Almost ready...",
];

export default function FullPageLoader({
  message,
  showBranding = true,
  className = ""
}: FullPageLoaderProps) {
  const [displayMessage, setDisplayMessage] = useState(message || defaultMessages[0]);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    if (message) {
      setDisplayMessage(message);
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        index = (index + 1) % defaultMessages.length;
        setDisplayMessage(defaultMessages[index]);
        setFadeIn(true);
      }, 200);
    }, 2000);

    return () => clearInterval(interval);
  }, [message]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg0)] transition-opacity duration-200 ${fadeIn ? "opacity-100" : "opacity-0"} ${className}`}
    >
      {showBranding && (
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-0 mb-3">
            <span
              className="font-[family-name:var(--font-display)] text-[28px] font-bold tracking-[0.1em]"
              style={{ color: "var(--text-primary)" }}
            >
              RESCUE
            </span>
            <span
              className="font-[family-name:var(--font-display)] text-[28px] font-bold tracking-[0.1em]"
              style={{ color: "var(--orange)" }}
            >
              GRID
            </span>
          </div>
          <div
            className="h-[2px] w-24 mx-auto rounded-full animate-pulse"
            style={{ backgroundColor: "var(--orange)" }}
          />
        </div>
      )}

      <LoadingSpinner size="xl" />

      <p
        className="mt-6 font-[family-name:var(--font-mono)] text-sm uppercase tracking-[0.15em]"
        style={{ color: "var(--text-dim)" }}
      >
        {displayMessage}
      </p>

      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2"
      >
        <div
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--orange)", animationDelay: "0ms" }}
        />
        <div
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--orange)", animationDelay: "150ms" }}
        />
        <div
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--orange)", animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
