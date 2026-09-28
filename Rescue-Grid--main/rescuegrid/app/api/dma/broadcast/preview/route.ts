import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { isBroadcastTarget, resolveBroadcastRecipients } from "@/lib/broadcast";

export async function GET(request: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target");
    const taskForceId = searchParams.get("taskForceId");

    if (!isBroadcastTarget(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
    if (target === "specific_task_force" && !taskForceId) {
      return NextResponse.json(
        { error: "taskForceId is required for specific_task_force target" },
        { status: 400 }
      );
    }

    // Same resolution as the real broadcast, so the preview can't disagree with it.
    const recipients = await resolveBroadcastRecipients(createServiceClient(), target, taskForceId);
    return NextResponse.json({ count: recipients.length });
  } catch (err) {
    console.error("Broadcast preview error:", err);
    return NextResponse.json({ error: "Failed to get recipient count" }, { status: 500 });
  }
}
