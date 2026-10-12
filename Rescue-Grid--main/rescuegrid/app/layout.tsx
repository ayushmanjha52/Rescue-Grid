import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

// Headings: a grotesque with a hand-drawn edge.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

// Body and UI text.
const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// Italic accents (the "Grid" in the wordmark, pull quotes).
const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Labels, timestamps, IDs and other data.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const DESCRIPTION =
  "Report an emergency, send an SOS by SMS without internet, or join as a volunteer. RescueGrid connects people in need with disaster-response teams in real time.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RescueGrid — Emergency help & disaster response",
    template: "%s · RescueGrid",
  },
  description: DESCRIPTION,
  applicationName: "RescueGrid",
  openGraph: {
    type: "website",
    siteName: "RescueGrid",
    title: "RescueGrid — Emergency help & disaster response",
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "RescueGrid — Emergency help & disaster response",
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: "RescueGrid",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${serif.variable} ${mono.variable}`}
    >
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
