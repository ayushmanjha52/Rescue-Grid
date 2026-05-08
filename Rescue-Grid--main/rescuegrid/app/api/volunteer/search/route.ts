import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q")?.trim() || "";
  const latitude = parseFloat(searchParams.get("lat") || "");
  const longitude = parseFloat(searchParams.get("lng") || "");
  const radius = parseFloat(searchParams.get("radius") || "50");
  const skills = searchParams.get("skills")?.split(",").filter(Boolean) || [];
  const equipment = searchParams.get("equipment")?.split(",").filter(Boolean) || [];
  const status = searchParams.get("status") || "active";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let supabaseQuery = supabase
      .from("volunteer")
      .select("id, name, mobile_no, type, latitude, longitude, skills, equipment, status, last_seen, accuracy", { count: "exact" });

    // Status filter - default to active, but allow 'all' to get everything
    if (status && status !== "all") {
      supabaseQuery = supabaseQuery.eq("status", status);
    }

    // Text search (case insensitive)
    if (query) {
      supabaseQuery = supabaseQuery.ilike("name", `%${query}%`);
    }

    if (skills.length > 0) {
      supabaseQuery = supabaseQuery.or(skills.map(s => `skills.ilike.%${s.trim()}%`).join(","));
    }

    if (equipment.length > 0) {
      supabaseQuery = supabaseQuery.or(equipment.map(e => `equipment.ilike.%${e.trim()}%`).join(","));
    }

    if (!isNaN(latitude) && !isNaN(longitude)) {
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos(latitude * Math.PI / 180));
      
      supabaseQuery = supabaseQuery
        .gte("latitude", latitude - latDelta)
        .lte("latitude", latitude + latDelta)
        .gte("longitude", longitude - lngDelta)
        .lte("longitude", longitude + lngDelta);
    }

    if (!isNaN(latitude) && !isNaN(longitude)) {
      supabaseQuery = supabaseQuery.order("latitude", { ascending: true });
    } else {
      supabaseQuery = supabaseQuery.order("name", { ascending: true });
    }

    supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);

    const { data: volunteers, error, count } = await supabaseQuery;

    if (error) {
      console.error("Volunteer search error:", error);
      return NextResponse.json(
        { error: "Failed to search volunteers" },
        { status: 500 }
      );
    }

    let results = volunteers || [];
    if (!isNaN(latitude) && !isNaN(longitude)) {
      results = results
        .map((v: any) => ({
          ...v,
          distance_km: v.latitude && v.longitude
            ? calculateDistance(latitude, longitude, v.latitude, v.longitude)
            : null,
        }))
        .sort((a: any, b: any) => {
          if (a.distance_km === null) return 1;
          if (b.distance_km === null) return -1;
          return a.distance_km - b.distance_km;
        })
        .filter((v: any) => v.distance_km === null || v.distance_km <= radius);
    }

    return NextResponse.json({
      data: results,
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (err) {
    console.error("Volunteer search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
