import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    
    const { resource_id, quantity, assignment_id, task_force_id, volunteer_id, notes } = body;
    
    if (!resource_id || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "Resource ID and positive quantity are required" },
        { status: 400 }
      );
    }
    
    const hasTarget = assignment_id || task_force_id || volunteer_id;
    if (!hasTarget) {
      return NextResponse.json(
        { error: "Must specify one target: assignment_id, task_force_id, or volunteer_id" },
        { status: 400 }
      );
    }
    
    const { data: resource } = await supabase
      .from("resource")
      .select("quantity")
      .eq("id", resource_id)
      .single();
    
    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }
    
    const { data: allocations } = await supabase
      .from("resource_allocation")
      .select("quantity_allocated")
      .eq("resource_id", resource_id)
      .in("status", ["allocated", "in_use"]);
    
    const allocated = allocations?.reduce((sum: number, a: { quantity_allocated: number }) => sum + a.quantity_allocated, 0) || 0;
    const available = resource.quantity - allocated;
    
    if (quantity > available) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${available}` },
        { status: 400 }
      );
    }
    
    const insertData: Record<string, unknown> = {
      resource_id,
      quantity_allocated: quantity,
      status: "allocated",
      notes: notes || null,
    };
    
    if (assignment_id) insertData.assignment_id = assignment_id;
    if (task_force_id) insertData.task_force_id = task_force_id;
    if (volunteer_id) insertData.volunteer_id = volunteer_id;
    
    const { data: allocation, error } = await supabase
      .from("resource_allocation")
      .insert(insertData)
      .select()
      .single();
    
    if (error) throw error;
    
    await supabase
      .from("resource")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", resource_id);
    
    return NextResponse.json(allocation, { status: 201 });
  } catch (err) {
    console.error("Allocate resource error:", err);
    return NextResponse.json(
      { error: "Failed to allocate resource" },
      { status: 500 }
    );
  }
}
