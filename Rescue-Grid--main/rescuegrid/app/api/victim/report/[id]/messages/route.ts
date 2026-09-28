import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    if (!reportId || !UUID_RE.test(reportId)) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("message")
      .select("id, content, sender_type, victim_report_id, created_at, read_at")
      .eq("victim_report_id", reportId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      console.error("Messages fetch error:", error);
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
