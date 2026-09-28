import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { NextResponse } from "next/server";
import { reportReference } from "@/lib/status";

type ServiceClient = ReturnType<typeof createServiceClient>;

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
  situation?: string;
  urgency?: string;
  status?: string;
  city?: string | null;
  district?: string | null;
}

interface MessageRow {
  content: string;
  created_at: string;
  is_flagged_for_dma: boolean | null;
  read_at: string | null;
  sender_type: string;
  sender_id: string | null;
  receiver_id: string | null;
  task_force_id: string | null;
  victim_report_id: string | null;
}

const MESSAGE_FIELDS =
  "content, created_at, is_flagged_for_dma, read_at, sender_type, sender_id, receiver_id, task_force_id, victim_report_id";

function summarize(messages: MessageRow[], isIncoming: (m: MessageRow) => boolean) {
  // messages are newest-first
  const last = messages[0];
  const unread = messages.filter((m) => isIncoming(m) && !m.read_at);
  return {
    last_message: last?.content,
    last_message_time: last?.created_at,
    unread_count: unread.length,
    is_flagged: messages.some((m) => m.is_flagged_for_dma && (!m.read_at || m === last)),
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const groups: Record<string, T[]> = {};
  for (const row of rows) {
    const k = key(row);
    if (k) (groups[k] ||= []).push(row);
  }
  return groups;
}

async function fetchVictimChannels(supabase: ServiceClient): Promise<Channel[]> {
  const { data: reports, error } = await supabase
    .from("victim_report")
    .select("id, phone_no, situation, urgency, status, city, district, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !reports || reports.length === 0) return [];

  const { data: messages } = await supabase
    .from("message")
    .select(MESSAGE_FIELDS)
    .in("victim_report_id", reports.map((r) => r.id))
    .order("created_at", { ascending: false })
    .limit(5000);

  const byReport = groupBy((messages || []) as MessageRow[], (m) => m.victim_report_id);

  return reports.map((vr) => ({
    id: vr.id,
    type: "victim_thread" as const,
    label: `REPORT #${reportReference(vr.id, vr.created_at)}`,
    subtitle: vr.city || vr.district || "Unknown location",
    phone_no: vr.phone_no,
    situation: vr.situation,
    urgency: vr.urgency,
    status: vr.status,
    city: vr.city,
    district: vr.district,
    ...summarize(byReport[vr.id] || [], (m) => m.sender_type === "victim"),
    // Reports without any messages still sort by when they came in.
    last_message_time: byReport[vr.id]?.[0]?.created_at ?? vr.created_at,
  }));
}

async function fetchTaskForceChannels(supabase: ServiceClient): Promise<Channel[]> {
  const { data: taskForces, error } = await supabase
    .from("task_force")
    .select("id, name, status, members:task_force_member(volunteer_id)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !taskForces || taskForces.length === 0) return [];

  const { data: messages } = await supabase
    .from("message")
    .select(MESSAGE_FIELDS)
    .in("task_force_id", taskForces.map((tf) => tf.id))
    .order("created_at", { ascending: false })
    .limit(5000);

  const byTaskForce = groupBy((messages || []) as MessageRow[], (m) => m.task_force_id);

  return taskForces.map((tf) => ({
    id: tf.id,
    type: "taskforce_room" as const,
    label: `TF · ${tf.name}`,
    subtitle: `${(tf.members as unknown[] | null)?.length || 0} members`,
    ...summarize(byTaskForce[tf.id] || [], (m) => m.sender_type === "volunteer"),
  }));
}

async function fetchVolunteerChannels(supabase: ServiceClient): Promise<Channel[]> {
  const { data: volunteers, error } = await supabase
    .from("volunteer")
    .select("id, name, type, status, mobile_no")
    .order("name", { ascending: true })
    .limit(1000);

  if (error || !volunteers || volunteers.length === 0) return [];

  const { data: messages } = await supabase
    .from("message")
    .select(MESSAGE_FIELDS)
    .is("task_force_id", null)
    .is("victim_report_id", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  // A direct message belongs to the volunteer on the other side of DMA.
  const byVolunteer = groupBy((messages || []) as MessageRow[], (m) =>
    m.sender_type === "dma" ? m.receiver_id : m.sender_id
  );

  const statusLabel = (status: string) =>
    status === "active" ? "Ready" : status === "on-mission" ? "On mission" : status === "standby" ? "Standby" : "Offline";

  return volunteers.map((vol) => ({
    id: vol.id,
    type: "direct" as const,
    label: vol.name,
    subtitle: `${vol.type || "Individual"} · ${statusLabel(vol.status)}`,
    phone_no: vol.mobile_no,
    status: vol.status,
    ...summarize(byVolunteer[vol.id] || [], (m) => m.sender_type === "volunteer"),
  }));
}

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();

    const [victimChannels, tfChannels, volChannels] = await Promise.all([
      fetchVictimChannels(supabase),
      fetchTaskForceChannels(supabase),
      fetchVolunteerChannels(supabase),
    ]);

    const channels: Channel[] = [...victimChannels, ...tfChannels, ...volChannels];

    channels.sort((a, b) => {
      if (a.is_flagged !== b.is_flagged) return a.is_flagged ? -1 : 1;
      if ((a.unread_count > 0) !== (b.unread_count > 0)) return a.unread_count > 0 ? -1 : 1;
      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.label.localeCompare(b.label);
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Channels API: Unexpected error:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
