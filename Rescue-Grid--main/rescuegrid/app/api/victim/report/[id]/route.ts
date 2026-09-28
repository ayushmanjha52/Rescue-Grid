import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("victim_report")
      // Whoever holds the link sees the report's progress, but not the
      // reporter's phone number or exact coordinates.
      .select("id, city, district, situation, custom_message, urgency, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Report fetch error:", error);
      return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ report: data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
