"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { HELPLINE_NUMBER } from "@/lib/config";

/**
 * "Call helpline" link. Phones open the dialer. Computers usually can't place
 * calls, so tapping it there also shows the number to dial from a phone,
 * instead of silently doing nothing.
 */
export default function HelplineLink({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [hint, setHint] = useState(false);

  return (
    <>
      <a
        href={`tel:${HELPLINE_NUMBER}`}
        className={className}
        style={style}
        onClick={() => {
          const canCall = window.matchMedia("(pointer: coarse)").matches;
          if (!canCall) setHint(true);
        }}
      >
        {children}
      </a>
      {hint && (
        <p className="mt-2 text-center font-body text-[13px] text-gray-700" role="status">
          Calls work from a phone. Dial <strong>{HELPLINE_NUMBER}</strong> from your mobile.
          <br />
          फ़ोन से <strong>{HELPLINE_NUMBER}</strong> पर कॉल करें।
        </p>
      )}
    </>
  );
}
