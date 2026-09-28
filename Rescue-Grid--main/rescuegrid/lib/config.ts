// Public, client-safe configuration.

/** Public address of the site, for absolute links (sitemap, social previews). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** India's national emergency number (ERSS). Accepts calls and SMS. */
export const NATIONAL_EMERGENCY_NUMBER = "112";

/**
 * Number that receives SOS text messages. Your Twilio number feeds reports into
 * RescueGrid through the twilio-sms-webhook. Until one is configured, SOS texts
 * go to 112 so they still reach emergency services.
 */
export const SOS_SMS_NUMBER = process.env.NEXT_PUBLIC_TWILIO_SMS_NUMBER || NATIONAL_EMERGENCY_NUMBER;

/** Number people call for help: your control room if set, otherwise 112. */
export const HELPLINE_NUMBER = process.env.NEXT_PUBLIC_HELPLINE_NUMBER || NATIONAL_EMERGENCY_NUMBER;

/** Cloudflare Turnstile site key; the bot check is off when unset. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/** Default map centre (Dhanbad, Jharkhand) used before a real location is known. */
export const DEFAULT_MAP_CENTER = { lat: 23.79, lng: 86.43 };

/** localStorage keys shared across the victim app. */
export const STORAGE_KEYS = {
  victimPhone: "victim_phone",
  lastLocation: "rescuegrid_last_location",
  myReports: "rescuegrid_my_report_ids",
} as const;
