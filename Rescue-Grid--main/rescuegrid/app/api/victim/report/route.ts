import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone_no, latitude, longitude, accuracy, situation, custom_message } = body;

    if (!phone_no || !latitude || !longitude || !situation) {
      return NextResponse.json(
        { error: "phone_no, latitude, longitude, and situation are required" },
        { status: 400 }
      );
    }

    let city = "";
    let district = "";

    try {
      const geoRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=place,district`
      );
      const geoData = await geoRes.json();
      if (geoData.features && geoData.features.length > 0) {
        const feature = geoData.features[0];
        city = feature.text || "";
        const districtFeature = feature.context?.find(
          (c: { id: string }) => c.id.startsWith("district")
        );
        district = districtFeature?.text || "";
      }
    } catch {
      // Geocoding failed — proceed without city/district
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("victim_report")
      .insert({
        phone_no,
        latitude,
        longitude,
        accuracy: accuracy || null,
        situation,
        custom_message: custom_message || null,
        city: city || null,
        district: district || null,
        status: "open",
        urgency: "moderate",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
