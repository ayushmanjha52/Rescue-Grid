import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono, Inter, IBM_Plex_Mono } from "next/font/google";
import OperationalToast from "@/components/shared/OperationalToast";
import { ClientWrapper } from "@/components/ClientWrapper";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "RescueGrid",
  description: "Tactical Disaster Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <OperationalToast />
        <ClientWrapper>{children}</ClientWrapper>
      </body>
    </html>
  );
}
