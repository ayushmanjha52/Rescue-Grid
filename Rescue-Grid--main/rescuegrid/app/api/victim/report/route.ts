import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePhone } from "@/lib/phone";
import { isSituation, SITUATION_URGENCY } from "@/lib/status";
import { clientIp, enforceRateLimits } from "@/lib/rateLimit";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 500;

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

async function reverseGeocode(latitude: number, longitude: number) {
  if (!MAPBOX_TOKEN) return { city: null, district: null };
  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=place,district,locality`,
      { signal: AbortSignal.timeout(4000) }
    );
    const geoData = await geoRes.json();
    const feature = geoData.features?.[0];
    if (!feature) return { city: null, district: null };
    const district = feature.context?.find((c: { id: string }) => c.id.startsWith("district"))?.text;
    return { city: feature.text || null, district: district || null };
  } catch {
    // Geocoding is best-effort — never block an emergency report on it.
    return { city: null, district: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { latitude, longitude, accuracy, situation } = body;
    const phone = normalizePhone(body.phone_no);

    if (!phone) {
      return NextResponse.json({ error: "A valid phone number is required" }, { status: 400 });
    }
    if (!isSituation(situation)) {
      return NextResponse.json({ error: "Unknown emergency type" }, { status: 400 });
    }

    const customMessage =
      typeof body.custom_message === "string" && body.custom_message.trim()
        ? body.custom_message.trim().slice(0, MAX_MESSAGE_LENGTH)
        : null;

    // GPS is preferred. An SOS without it is still accepted if the person
    // described where they are, like an SMS SOS; the team calls them back.
    const hasCoordinates = isCoordinate(latitude, 90) && isCoordinate(longitude, 180);
    if (!hasCoordinates && (latitude != null || longitude != null)) {
      return NextResponse.json({ error: "A valid location is required" }, { status: 400 });
    }
    if (!hasCoordinates && (!customMessage || customMessage.length < 5)) {
      return NextResponse.json({ error: "Location required: share GPS, or describe where you are" }, { status: 400 });
    }

    // Generous limits: many phones share one IP on mobile networks and in camps.
    const limited = await enforceRateLimits(
      [
        { key: `victim-report:ip:${clientIp(req)}`, limit: 30, windowSeconds: 600 },
        { key: `victim-report:phone:${phone}`, limit: 6, windowSeconds: 600 },
      ],
      "Too many reports in a short time. If you need help now, call the helpline or send an SOS by SMS."
    );
    if (limited) return limited;

    const supabase = createServiceClient();

    // Retries on flaky networks (or double taps) must not create duplicate reports.
    const { data: recent } = await supabase
      .from("victim_report")
      .select("id")
      .eq("phone_no", phone)
      .eq("situation", situation)
      .neq("status", "resolved")
      .gte("created_at", new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      if (customMessage) {
        await supabase.from("message").insert({
          content: customMessage,
          sender_type: "victim",
          victim_report_id: recent[0].id,
        });
      }
      return NextResponse.json({ id: recent[0].id, duplicate: true }, { status: 200 });
    }

    const { city, district } = hasCoordinates ? await reverseGeocode(latitude, longitude) : { city: null, district: null };

    const { data, error } = await supabase
      .from("victim_report")
      .insert({
        phone_no: phone,
        latitude: hasCoordinates ? latitude : null,
        longitude: hasCoordinates ? longitude : null,
        accuracy: typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null,
        situation,
        custom_message: customMessage,
        city,
        district,
        status: "open",
        urgency: SITUATION_URGENCY[situation],
      })
      .select("id")
      .single();

    if (error) {
      console.error("Victim report insert error:", error);
      return NextResponse.json({ error: "Could not save report. Please try again or use SMS." }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error("Victim report error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
