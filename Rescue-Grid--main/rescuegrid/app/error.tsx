"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HELPLINE_NUMBER } from "@/lib/config";

// Shown when a page crashes. No technical details are displayed; the error
// is logged to the browser console for debugging.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-inter text-[20px] font-semibold text-gray-900 mb-2">Something went wrong</h1>
      <p className="font-inter text-[14px] text-gray-600 max-w-sm mb-8">
        Please try again. If you need help urgently, call the helpline or send an SOS by SMS.
        <br />
        कृपया फिर से प्रयास करें। तुरंत मदद के लिए हेल्पलाइन पर कॉल करें।
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={reset} className="py-3 bg-orange text-white font-ibm-mono text-[13px] uppercase tracking-[0.15em] rounded-sm">
          Try again
        </button>
        <a
          href={`tel:${HELPLINE_NUMBER}`}
          className="block py-3 border border-orange text-orange font-ibm-mono text-[13px] uppercase tracking-[0.15em] rounded-sm"
        >
          📞 Call {HELPLINE_NUMBER}
        </a>
        <Link href="/" className="font-ibm-mono text-[12px] text-gray-600 underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
