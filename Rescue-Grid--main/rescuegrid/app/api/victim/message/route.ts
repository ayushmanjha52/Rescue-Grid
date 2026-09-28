import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanMessageContent, MAX_MESSAGE_LENGTH } from "@/lib/messages";
import { clientIp, enforceRateLimits } from "@/lib/rateLimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const content = cleanMessageContent(body.content);
    const reportId = body.victim_report_id;

    if (!content || typeof reportId !== "string" || !UUID_RE.test(reportId)) {
      return NextResponse.json(
        { error: `Message (max ${MAX_MESSAGE_LENGTH} chars) and victim_report_id are required` },
        { status: 400 }
      );
    }

    const limited = await enforceRateLimits(
      [
        { key: `victim-message:ip:${clientIp(req)}`, limit: 60, windowSeconds: 600 },
        { key: `victim-message:report:${reportId}`, limit: 30, windowSeconds: 600 },
      ],
      "You're sending messages too quickly. Please wait a moment and try again."
    );
    if (limited) return limited;

    const supabase = createServiceClient();

    const { data: report } = await supabase
      .from("victim_report")
      .select("id")
      .eq("id", reportId)
      .maybeSingle();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("message")
      .insert({
        content,
        sender_type: "victim",
        victim_report_id: reportId,
        sender_id: null,
      })
      .select("id, content, sender_type, victim_report_id, created_at, read_at")
      .single();

    if (error) {
      console.error("Victim message insert error:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
