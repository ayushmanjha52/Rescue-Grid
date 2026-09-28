import Link from "next/link";
import type { Metadata } from "next";
import { HELPLINE_NUMBER } from "@/lib/config";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <Link href="/" className="font-inter text-[28px] font-bold tracking-[0.1em] mb-6" aria-label="RescueGrid home">
        <span className="text-gray-900">RESCUE</span>
        <span className="text-orange">GRID</span>
      </Link>
      <p className="font-ibm-mono text-[12px] text-gray-500 uppercase tracking-widest mb-2">404</p>
      <h1 className="font-inter text-[20px] font-semibold text-gray-900 mb-2">This page doesn&apos;t exist</h1>
      <p className="font-inter text-[14px] text-gray-600 max-w-sm mb-8">
        The link may be wrong or out of date. / यह पेज मौजूद नहीं है।
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/" className="block py-3 bg-orange text-white font-ibm-mono text-[13px] uppercase tracking-[0.15em] rounded-sm">
          Report an emergency
        </Link>
        <a
          href={`tel:${HELPLINE_NUMBER}`}
          className="block py-3 border border-orange text-orange font-ibm-mono text-[13px] uppercase tracking-[0.15em] rounded-sm"
        >
          📞 Call {HELPLINE_NUMBER}
        </a>
      </div>
    </main>
  );
}
