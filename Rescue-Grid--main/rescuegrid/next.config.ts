import path from "node:path";
import type { NextConfig } from "next";

// Extra origins (e.g. your laptop's LAN IP for testing on a phone) allowed to
// load dev resources: ALLOWED_DEV_ORIGINS="192.168.1.20,10.0.0.5"
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

// Origins the browser may talk to: our Supabase project (REST + realtime
// websocket), Mapbox (tiles, styles, geocoding, directions) and Cloudflare
// Turnstile (optional bot check).
function supabaseOrigins() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}

const MAPBOX = ["https://api.mapbox.com", "https://*.tiles.mapbox.com", "https://events.mapbox.com"];
const TURNSTILE = "https://challenges.cloudflare.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode also needs eval for fast refresh.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com",
  "font-src 'self' data:",
  `connect-src 'self' ${[...supabaseOrigins(), ...MAPBOX].join(" ")}${isDev ? " ws: http://localhost:*" : ""}`,
  // Mapbox GL renders in web workers created from blobs.
  "worker-src 'self' blob:",
  "child-src blob:",
  `frame-src ${TURNSTILE}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Browsers only honour this over HTTPS: always use HTTPS for two years.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is core to the app; camera/microphone are not used.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root so lockfiles in parent folders aren't picked up.
  turbopack: { root: path.resolve(__dirname) },
  allowedDevOrigins,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must never be served stale.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
