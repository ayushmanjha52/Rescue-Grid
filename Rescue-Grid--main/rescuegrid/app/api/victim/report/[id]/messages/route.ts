import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    if (!reportId) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("message")
      .select("*")
      .eq("victim_report_id", reportId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}