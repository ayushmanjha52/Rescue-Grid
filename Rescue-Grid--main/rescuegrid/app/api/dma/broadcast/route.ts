import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { sendPushToVolunteers } from "@/lib/push/sendPush";
import { isBroadcastTarget, resolveBroadcastRecipients } from "@/lib/broadcast";

const MAX_BROADCAST_LENGTH = 500;
const INSERT_BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));
    const { target, taskForceId } = body;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_BROADCAST_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_BROADCAST_LENGTH} characters or less` },
        { status: 400 }
      );
    }
    if (!isBroadcastTarget(target)) {
      return NextResponse.json({ error: "Valid target is required" }, { status: 400 });
    }
    if (target === "specific_task_force" && !taskForceId) {
      return NextResponse.json(
        { error: "taskForceId is required for specific_task_force target" },
        { status: 400 }
      );
    }

    const volunteerIds = await resolveBroadcastRecipients(supabase, target, taskForceId);

    if (volunteerIds.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    // One direct message per volunteer so it lands in each inbox.
    const rows = volunteerIds.map((volunteerId) => ({
      content: message,
      sender_type: "dma",
      sender_id: null,
      receiver_id: volunteerId,
      task_force_id: null,
      victim_report_id: null,
      is_flagged_for_dma: false,
    }));

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const { error: insertError } = await supabase.from("message").insert(rows.slice(i, i + INSERT_BATCH_SIZE));
      if (insertError) throw insertError;
    }

    await sendPushToVolunteers(
      supabase,
      volunteerIds,
      "🚨 Emergency Broadcast",
      message.substring(0, 120),
      "/volunteer/inbox"
    );

    return NextResponse.json(
      {
        sent: volunteerIds.length,
        message: `Broadcast sent to ${volunteerIds.length} volunteer${volunteerIds.length === 1 ? "" : "s"}`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Broadcast error:", err);
    return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
  }
}
