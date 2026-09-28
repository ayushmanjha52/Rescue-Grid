import { NextResponse } from "next/server";
import { getVolunteerTaskForceIds, requireVolunteer } from "@/lib/auth/getVolunteer";
import { createServiceClient } from "@/lib/supabase/service";
import { ALLOCATION_ACTIVE } from "@/lib/status";

const ACTIVE = ALLOCATION_ACTIVE as unknown as string[];

export async function GET() {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();
    const taskForceIds = await getVolunteerTaskForceIds(supabase, volunteerId);

    const [{ data: myAllocations }, tfResult, { data: history }] = await Promise.all([
      supabase
        .from("resource_allocation")
        .select(`
          *,
          resource:resource_id(name, type, unit, location),
          assignment:assignment_id(task)
        `)
        .eq("volunteer_id", volunteerId)
        .in("status", ACTIVE)
        .order("allocated_at", { ascending: false }),
      taskForceIds.length > 0
        ? supabase
            .from("resource_allocation")
            .select(`
              *,
              resource:resource_id(name, type, unit, location),
              task_force:task_force_id(name)
            `)
            .in("task_force_id", taskForceIds)
            .in("status", ACTIVE)
            .order("allocated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from("resource_allocation")
        .select(`
          *,
          resource:resource_id(name, type, unit),
          assignment:assignment_id(task)
        `)
        .eq("volunteer_id", volunteerId)
        .not("status", "in", `(${ACTIVE.join(",")})`)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      mine: myAllocations || [],
      taskForce: tfResult.data || [],
      history: history || [],
    });
  } catch (err) {
    console.error("Get volunteer resources error:", err);
    return NextResponse.json({ error: "Failed to get resources" }, { status: 500 });
  }
}
