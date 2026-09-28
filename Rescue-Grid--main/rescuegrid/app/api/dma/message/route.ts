import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { cleanMessageContent, MAX_MESSAGE_LENGTH, withSenderNames } from "@/lib/messages";
import { sendPushToVolunteers } from "@/lib/push/sendPush";
import { notifyReportUpdated } from "@/lib/notify";
import { NextResponse } from "next/server";

const MAX_HISTORY = 500;
// channel_id is interpolated into a PostgREST filter, so it must be a plain UUID.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const channelType = searchParams.get("channel_type");
  const channelId = searchParams.get("channel_id");

  if (!channelId || !UUID_RE.test(channelId) || !["victim_thread", "taskforce_room", "direct"].includes(channelType || "")) {
    return NextResponse.json({ error: "Invalid channel parameters" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    let query = supabase.from("message").select("*");
    let victimLabel = "Victim";

    if (channelType === "victim_thread") {
      query = query.eq("victim_report_id", channelId);
      const { data: report } = await supabase
        .from("victim_report")
        .select("phone_no")
        .eq("id", channelId)
        .maybeSingle();
      victimLabel = report?.phone_no || "Victim";
    } else if (channelType === "taskforce_room") {
      query = query.eq("task_force_id", channelId);
    } else {
      query = query
        .or(`receiver_id.eq.${channelId},sender_id.eq.${channelId}`)
        .is("task_force_id", null)
        .is("victim_report_id", null);
    }

    const { data: messages, error } = await query
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY);

    if (error) throw error;

    return NextResponse.json(await withSenderNames(supabase, (messages || []).reverse(), victimLabel));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const supabase = createServiceClient();

  try {
    const body = await request.json().catch(() => ({}));
    const { channel_type, task_force_id, victim_report_id, receiver_id } = body;
    const content = cleanMessageContent(body.content);

    if (!content || !channel_type) {
      return NextResponse.json(
        { error: `Message (max ${MAX_MESSAGE_LENGTH} chars) and channel_type are required` },
        { status: 400 }
      );
    }

    const insertData: Record<string, unknown> = {
      content,
      sender_type: "dma",
    };
    let pushRecipients: string[] = [];

    if (channel_type === "victim_thread" && victim_report_id) {
      insertData.victim_report_id = victim_report_id;
    } else if (channel_type === "taskforce_room" && task_force_id) {
      insertData.task_force_id = task_force_id;
      const { data: members } = await supabase
        .from("task_force_member")
        .select("volunteer_id")
        .eq("task_force_id", task_force_id);
      pushRecipients = (members || []).map((m: { volunteer_id: string }) => m.volunteer_id);
    } else if (channel_type === "direct" && receiver_id) {
      insertData.receiver_id = receiver_id;
      pushRecipients = [receiver_id];
    } else {
      return NextResponse.json({ error: "Invalid channel configuration" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("message")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    if (channel_type === "victim_thread") await notifyReportUpdated(victim_report_id);

    await sendPushToVolunteers(
      supabase,
      pushRecipients,
      "📨 DMA Command",
      content.substring(0, 120),
      channel_type === "taskforce_room" ? `/volunteer/chat/${task_force_id}` : "/volunteer/inbox"
    );

    const [withName] = await withSenderNames(supabase, [data]);
    return NextResponse.json(withName, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
