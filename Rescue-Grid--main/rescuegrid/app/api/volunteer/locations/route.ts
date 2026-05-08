import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const DISTRICT_BOUNDS = {
  lat_min: 23.62, lat_max: 23.92,
  lng_min: 86.20, lng_max: 86.58,
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const bbox = searchParams.get('bbox');
    
    let minLat = DISTRICT_BOUNDS.lat_min;
    let maxLat = DISTRICT_BOUNDS.lat_max;
    let minLng = DISTRICT_BOUNDS.lng_min;
    let maxLng = DISTRICT_BOUNDS.lng_max;
    
    if (bbox) {
      const [bMinLng, bMinLat, bMaxLng, bMaxLat] = bbox.split(',').map(parseFloat);
      minLat = Math.max(bMinLat, DISTRICT_BOUNDS.lat_min);
      maxLat = Math.min(bMaxLat, DISTRICT_BOUNDS.lat_max);
      minLng = Math.max(bMinLng, DISTRICT_BOUNDS.lng_min);
      maxLng = Math.min(bMaxLng, DISTRICT_BOUNDS.lng_max);
    }

    const { data, error } = await supabase
      .from("volunteer")
      .select("id, name, mobile_no, latitude, longitude, status, type, skills, equipment, last_seen")
      .in('status', ['active', 'standby', 'on-mission'])
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}
