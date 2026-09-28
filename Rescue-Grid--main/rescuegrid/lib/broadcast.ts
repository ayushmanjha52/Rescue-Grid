import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

export const BROADCAST_TARGETS = ["all_volunteers", "specific_task_force", "everyone"] as const;
export type BroadcastTarget = (typeof BROADCAST_TARGETS)[number];

export function isBroadcastTarget(value: unknown): value is BroadcastTarget {
  return typeof value === "string" && (BROADCAST_TARGETS as readonly string[]).includes(value);
}

/**
 * Resolves the volunteer ids a broadcast reaches.
 *  - all_volunteers: volunteers currently on duty (active or on a mission)
 *  - specific_task_force: members of one task force
 *  - everyone: every registered volunteer
 */
export async function resolveBroadcastRecipients(
  supabase: ServiceClient,
  target: BroadcastTarget,
  taskForceId?: string | null
): Promise<string[]> {
  if (target === "specific_task_force") {
    if (!taskForceId) return [];
    const { data } = await supabase
      .from("task_force_member")
      .select("volunteer_id")
      .eq("task_force_id", taskForceId);
    return [...new Set((data || []).map((m: { volunteer_id: string }) => m.volunteer_id).filter(Boolean))];
  }

  let query = supabase.from("volunteer").select("id");
  if (target === "all_volunteers") {
    query = query.in("status", ["active", "on-mission"]);
  }
  const { data } = await query;
  return (data || []).map((v: { id: string }) => v.id);
}
