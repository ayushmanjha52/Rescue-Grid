import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { NextResponse } from "next/server";

/** Marks every incoming (non-DMA) message in a channel as read by DMA. */
export async function PATCH(request: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const supabase = createServiceClient();

  try {
    const { channel_type, channel_id } = await request.json().catch(() => ({}));

    if (!channel_type || !channel_id) {
      return NextResponse.json(
        { error: "channel_type and channel_id are required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("message")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .neq("sender_type", "dma");

    if (channel_type === "victim_thread") {
      query = query.eq("victim_report_id", channel_id);
    } else if (channel_type === "taskforce_room") {
      query = query.eq("task_force_id", channel_id);
    } else if (channel_type === "direct") {
      // Incoming direct messages are the ones the volunteer sent to DMA.
      query = query
        .eq("sender_id", channel_id)
        .is("task_force_id", null)
        .is("victim_report_id", null);
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
