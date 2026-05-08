import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const { channel_type, channel_id } = body;

    if (!channel_type || !channel_id) {
      return NextResponse.json(
        { error: "channel_type and channel_id are required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("message")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);

    if (channel_type === "victim_thread") {
      query = query.eq("victim_report_id", channel_id);
    } else if (channel_type === "taskforce_room") {
      query = query.eq("task_force_id", channel_id);
    } else if (channel_type === "direct") {
      query = query.eq("receiver_id", channel_id);
    } else {
      return NextResponse.json({ error: "Invalid channel type" }, { status: 400 });
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }
}
