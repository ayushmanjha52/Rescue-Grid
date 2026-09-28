import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isTaskForceMember, requireVolunteer } from "@/lib/auth/getVolunteer";
import { AllocationError, updateAllocation } from "@/lib/resources";
import type { AllocationStatus } from "@/lib/status";

const VOLUNTEER_ALLOCATION_STATUSES: AllocationStatus[] = ["in_use", "consumed", "returned"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { status, quantity_consumed, quantity_returned, notes } = body;

    if (!VOLUNTEER_ALLOCATION_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required (in_use, consumed, returned)" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: allocation } = await supabase
      .from("resource_allocation")
      .select("id, volunteer_id, task_force_id")
      .eq("id", id)
      .maybeSingle();

    if (!allocation) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }

    const canUpdate =
      allocation.volunteer_id === volunteerId ||
      (!!allocation.task_force_id && (await isTaskForceMember(supabase, volunteerId, allocation.task_force_id)));

    if (!canUpdate) {
      return NextResponse.json({ error: "Not authorized to update this allocation" }, { status: 403 });
    }

    const updated = await updateAllocation(supabase, id, {
      status,
      quantity_consumed,
      quantity_returned,
      notes: typeof notes === "string" ? notes.slice(0, 500) : undefined,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AllocationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update volunteer allocation error:", err);
    return NextResponse.json({ error: "Failed to update allocation" }, { status: 500 });
  }
}
