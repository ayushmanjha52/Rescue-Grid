import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { ASSIGNMENT_IN_PROGRESS } from "@/lib/status";

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();

    const [criticalResult, activeResult, volsResult] = await Promise.all([
      supabase
        .from("victim_report")
        .select("id", { count: "exact", head: true })
        .eq("urgency", "critical")
        .not("status", "in", "(resolved,duplicate)"),
      supabase
        .from("assignment")
        .select("id", { count: "exact", head: true })
        .in("status", ASSIGNMENT_IN_PROGRESS as unknown as string[]),
      // Volunteers on duty: ready to deploy or already on a mission.
      supabase
        .from("volunteer")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "on-mission"]),
    ]);

    return NextResponse.json({
      critical: criticalResult.count ?? 0,
      active: activeResult.count ?? 0,
      vols: volsResult.count ?? 0,
    });
  } catch (err) {
    console.error("Counters error:", err);
    return NextResponse.json({ error: "Failed to load counters" }, { status: 500 });
  }
}
