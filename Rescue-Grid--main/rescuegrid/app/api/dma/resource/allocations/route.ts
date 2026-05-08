import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    
    const resource_id = searchParams.get("resource_id");
    const assignment_id = searchParams.get("assignment_id");
    const task_force_id = searchParams.get("task_force_id");
    const volunteer_id = searchParams.get("volunteer_id");
    const status = searchParams.get("status");
    
    let query = supabase
      .from("resource_allocation")
      .select(`
        *,
        resource:resource_id(name, type, unit),
        assignment:assignment_id(task),
        task_force:task_force_id(name),
        volunteer:volunteer_id(name)
      `)
      .order("allocated_at", { ascending: false });
    
    if (resource_id) query = query.eq("resource_id", resource_id);
    if (assignment_id) query = query.eq("assignment_id", assignment_id);
    if (task_force_id) query = query.eq("task_force_id", task_force_id);
    if (volunteer_id) query = query.eq("volunteer_id", volunteer_id);
    if (status) query = query.eq("status", status);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("List allocations error:", err);
    return NextResponse.json(
      { error: "Failed to list allocations" },
      { status: 500 }
    );
  }
}
