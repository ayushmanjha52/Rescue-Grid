import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { parseBBox } from "@/lib/geo";

const MAP_STATUSES = ["active", "standby", "on-mission"];

/** Volunteers with a known location (optionally limited to a bbox) for the DMA map. */
export async function GET(req: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const bbox = parseBBox(new URL(req.url).searchParams.get("bbox"));

    let query = supabase
      .from("volunteer")
      .select("id, name, mobile_no, latitude, longitude, status, type, skills, equipment, last_seen, tier")
      .in("status", MAP_STATUSES)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (bbox) {
      query = query
        .gte("latitude", bbox.minLat)
        .lte("latitude", bbox.maxLat)
        .gte("longitude", bbox.minLng)
        .lte("longitude", bbox.maxLng);
    }

    const { data, error } = await query.limit(1000);
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Volunteer locations error:", err);
    return NextResponse.json({ error: "Failed to load volunteer locations" }, { status: 500 });
  }
}
