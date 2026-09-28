import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { isReportId, MAX_REMEMBERED_REPORTS } from "@/lib/myReports";
import { clientIp, enforceRateLimits } from "@/lib/rateLimit";

/**
 * GET  /api/victim/reports → full list for the DMA dashboard (auth required).
 * POST /api/victim/reports → "My Reports" for a victim: `{ ids }` holds the
 *      report ids remembered on their device. Report ids are unguessable, so
 *      knowing one is what proves you sent (or were sent) the report.
 *
 * There is deliberately no lookup by phone number: anyone who knows a
 * person's number could otherwise find their reports.
 */
export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.has("phone")) {
    return NextResponse.json(
      { error: "Looking up reports by phone number is no longer supported. Open the report link, or call the helpline." },
      { status: 400 }
    );
  }

  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("victim_report")
      .select("id, phone_no, latitude, longitude, accuracy, city, district, situation, urgency, status, created_at, updated_at, custom_message")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Victim report list error:", error);
      return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: unknown[] = Array.isArray(body.ids) ? body.ids : [];
    const validIds = [...new Set(ids.filter(isReportId))].slice(0, MAX_REMEMBERED_REPORTS);

    if (validIds.length === 0) {
      return NextResponse.json({ reports: [] }, { status: 200 });
    }

    const limited = await enforceRateLimits([{ key: `my-reports:ip:${clientIp(req)}`, limit: 60, windowSeconds: 600 }]);
    if (limited) return limited;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("victim_report")
      .select("id, city, district, situation, urgency, status, created_at, custom_message")
      .in("id", validIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("My reports lookup error:", error);
      return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
    }
    return NextResponse.json({ reports: data || [] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
