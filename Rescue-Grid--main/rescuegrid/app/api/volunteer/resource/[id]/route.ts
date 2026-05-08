import { NextRequest, NextResponse } from "next/server";
import { getVolunteerFromDb } from "@/lib/auth/getVolunteer";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const volunteer = await getVolunteerFromDb();
    
    if (!volunteer) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const body = await request.json();
    const { status, quantity_consumed, quantity_returned, notes } = body;
    
    const validStatuses = ["in_use", "consumed", "returned"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required (in_use, consumed, returned)" },
        { status: 400 }
      );
    }
    
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    
    const { data: allocation } = await supabase
      .from("resource_allocation")
      .select("id, volunteer_id, task_force_id, quantity_allocated")
      .eq("id", id)
      .single();
    
    if (!allocation) {
      return NextResponse.json(
        { error: "Allocation not found" },
        { status: 404 }
      );
    }
    
    const canUpdate = 
      allocation.volunteer_id === volunteer.id ||
      (allocation.task_force_id && await checkTaskForceMembership(supabase, volunteer.id, allocation.task_force_id));
    
    if (!canUpdate) {
      return NextResponse.json(
        { error: "Not authorized to update this allocation" },
        { status: 403 }
      );
    }
    
    const updateData: Record<string, unknown> = { 
      status,
      updated_at: new Date().toISOString() 
    };
    
    if (quantity_consumed !== undefined) {
      if (quantity_consumed > allocation.quantity_allocated) {
        return NextResponse.json(
          { error: "Consumed quantity cannot exceed allocated quantity" },
          { status: 400 }
        );
      }
      updateData.quantity_consumed = quantity_consumed;
    }
    
    if (quantity_returned !== undefined) {
      if (quantity_returned > allocation.quantity_allocated) {
        return NextResponse.json(
          { error: "Returned quantity cannot exceed allocated quantity" },
          { status: 400 }
        );
      }
      updateData.quantity_returned = quantity_returned;
    }
    
    if (notes !== undefined) updateData.notes = notes;
    
    const { data, error } = await supabase
      .from("resource_allocation")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err) {
    console.error("Update volunteer allocation error:", err);
    return NextResponse.json(
      { error: "Failed to update allocation" },
      { status: 500 }
    );
  }
}

async function checkTaskForceMembership(supabase: ReturnType<typeof import("@/lib/supabase/service").createServiceClient>, volunteerId: string, taskForceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("task_force_member")
    .select("id")
    .eq("volunteer_id", volunteerId)
    .eq("task_force_id", taskForceId)
    .single();
  
  return !!data;
}
