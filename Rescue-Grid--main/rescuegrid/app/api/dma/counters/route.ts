import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();

    const [criticalResult, activeResult, volsResult] = await Promise.all([
      supabase
        .from("victim_report")
        .select("id", { count: "exact", head: true })
        .eq("urgency", "critical")
        .neq("status", "resolved"),
      supabase
        .from("assignment")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "on_my_way", "arrived"]),
      supabase
        .from("volunteer")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    return NextResponse.json({
      critical: criticalResult.count ?? 0,
      active: activeResult.count ?? 0,
      vols: volsResult.count ?? 0,
    });
  } catch {
    return NextResponse.json({ critical: 0, active: 0, vols: 0 });
  }
}
