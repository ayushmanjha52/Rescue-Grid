import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

interface Channel {
  id: string;
  type: "victim_thread" | "taskforce_room" | "direct";
  label: string;
  subtitle: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  is_flagged: boolean;
  phone_no?: string;
}

async function fetchVictimChannels(supabase: ReturnType<typeof createServiceClient>): Promise<Channel[]> {
  const { data: victimReports, error: vrError } = await supabase
    .from("victim_report")
    .select("id, phone_no, situation, city, district, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (vrError || !victimReports) return [];

  const channelPromises = victimReports.map(async (vr) => {
    const [{ data: lastMsg }, { count }] = await Promise.all([
      supabase
        .from("message")
        .select("content, created_at, is_flagged_for_dma")
        .eq("victim_report_id", vr.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("message")
        .select("*", { count: "exact", head: true })
        .eq("victim_report_id", vr.id)
        .is("read_at", null)
        .neq("sender_type", "dma")
    ]);

    return {
      id: vr.id,
      type: "victim_thread" as const,
      label: `REPORT #KL-${new Date(vr.created_at).getFullYear()}-${vr.id.slice(0, 4).toUpperCase()}`,
      subtitle: `${vr.situation} · ${vr.city || vr.district || "Unknown"}`,
      last_message: lastMsg?.content,
      last_message_time: lastMsg?.created_at,
      unread_count: count || 0,
      is_flagged: lastMsg?.is_flagged_for_dma || false,
    };
  });

  return Promise.all(channelPromises);
}

async function fetchTaskForceChannels(supabase: ReturnType<typeof createServiceClient>): Promise<Channel[]> {
  const { data: taskForces, error: tfError } = await supabase
    .from("task_force")
    .select("id, name, status")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (tfError || !taskForces) return [];

  const channelPromises = taskForces.map(async (tf) => {
    const [{ data: lastMsg }, { count }, { data: members }] = await Promise.all([
      supabase
        .from("message")
        .select("content, created_at, is_flagged_for_dma")
        .eq("task_force_id", tf.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("message")
        .select("*", { count: "exact", head: true })
        .eq("task_force_id", tf.id)
        .is("read_at", null)
        .neq("sender_type", "dma"),
      supabase
        .from("task_force_member")
        .select("volunteer_id")
        .eq("task_force_id", tf.id)
    ]);

    return {
      id: tf.id,
      type: "taskforce_room" as const,
      label: `TF · ${tf.name}`,
      subtitle: `${members?.length || 0} members`,
      last_message: lastMsg?.content,
      last_message_time: lastMsg?.created_at,
      unread_count: count || 0,
      is_flagged: lastMsg?.is_flagged_for_dma || false,
    };
  });

  return Promise.all(channelPromises);
}

async function fetchVolunteerChannels(supabase: ReturnType<typeof createServiceClient>): Promise<Channel[]> {
  const { data: volunteers, error: volError } = await supabase
    .from("volunteer")
    .select("id, name, type, status, mobile_no")
    .order("name", { ascending: true })
    .limit(20);

  if (volError || !volunteers) return [];

  const volunteerIds = volunteers.map(v => v.id);
  if (volunteerIds.length === 0) return [];

  const { data: allMessages, error: msgError } = await supabase
    .from("message")
    .select("content, created_at, is_flagged_for_dma, read_at, receiver_id, sender_id, sender_type")
    .or(`receiver_id.in.(${volunteerIds.join(',')}),sender_id.in.(${volunteerIds.join(',')})`)
    .is("task_force_id", null)
    .is("victim_report_id", null)
    .order("created_at", { ascending: false });

  if (msgError || !allMessages) {
    return volunteers.map(vol => ({
      id: vol.id,
      type: "direct" as const,
      label: vol.name,
      subtitle: `${vol.type || "Individual"} · ${vol.status === "active" ? "Ready" : "Offline"}`,
      last_message: undefined,
      last_message_time: undefined,
      unread_count: 0,
      is_flagged: false,
      phone_no: vol.mobile_no,
    }));
  }

  const msgByVolunteer: Record<string, typeof allMessages> = {};
  allMessages.forEach(msg => {
    const volunteerSet = new Set(volunteerIds);
    if (msg.receiver_id && volunteerSet.has(msg.receiver_id)) {
      if (!msgByVolunteer[msg.receiver_id]) msgByVolunteer[msg.receiver_id] = [];
      msgByVolunteer[msg.receiver_id].push(msg);
    }
    if (msg.sender_id && volunteerSet.has(msg.sender_id)) {
      if (!msgByVolunteer[msg.sender_id]) msgByVolunteer[msg.sender_id] = [];
      msgByVolunteer[msg.sender_id].push(msg);
    }
  });

  return volunteers.map(vol => {
    const msgs = msgByVolunteer[vol.id] || [];
    const lastMsg = msgs.length > 0 ? msgs[0] : null;
    const unreadCount = msgs.filter(m => !m.read_at && m.sender_type !== "dma").length;

    return {
      id: vol.id,
      type: "direct" as const,
      label: vol.name,
      subtitle: `${vol.type || "Individual"} · ${vol.status === "active" ? "Ready" : "Offline"}`,
      last_message: lastMsg?.content,
      last_message_time: lastMsg?.created_at,
      unread_count: unreadCount,
      is_flagged: lastMsg?.is_flagged_for_dma || false,
      phone_no: vol.mobile_no,
    };
  });
}

export async function GET() {
  try {
    const supabase = createServiceClient();

    console.log("Channels API: Starting parallel fetch...");

    const [victimChannels, tfChannels, volChannels] = await Promise.all([
      fetchVictimChannels(supabase),
      fetchTaskForceChannels(supabase),
      fetchVolunteerChannels(supabase)
    ]);

    const channels: Channel[] = [...victimChannels, ...tfChannels, ...volChannels];

    channels.sort((a, b) => {
      if (a.is_flagged && !b.is_flagged) return -1;
      if (!a.is_flagged && b.is_flagged) return 1;
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (a.unread_count === 0 && b.unread_count > 0) return 1;
      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return timeB - timeA;
    });

    console.log("Channels API: Returning", channels.length, "channels");

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Channels API: Unexpected error:", error);
    return NextResponse.json({ error: "Failed to fetch channels", details: String(error) }, { status: 500 });
  }
}
