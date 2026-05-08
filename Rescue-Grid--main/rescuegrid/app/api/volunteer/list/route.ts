import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    // Fetch volunteers
    const { data: volunteers, error } = await supabase
      .from("volunteer")
      .select("id, name, type, skills, status, last_seen, latitude, longitude")
      .order("status");

    if (error) throw error;
    if (!volunteers || volunteers.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all active resource allocations for these volunteers
    const volunteerIds = volunteers.map(v => v.id);
    const { data: allocations } = await supabase
      .from("resource_allocation")
      .select(`
        id, volunteer_id, quantity_allocated, status,
        resource:resource_id(name, type, unit)
      `)
      .in("volunteer_id", volunteerIds)
      .in("status", ["allocated", "in_use"]);

    // Group allocations by volunteer
    const allocationsByVolunteer: Record<string, any[]> = {};
    allocations?.forEach(alloc => {
      if (!allocationsByVolunteer[alloc.volunteer_id]) {
        allocationsByVolunteer[alloc.volunteer_id] = [];
      }
      allocationsByVolunteer[alloc.volunteer_id].push(alloc);
    });

    // Merge allocations into volunteer objects
    const volunteersWithResources = volunteers.map(v => ({
      ...v,
      resource_allocations: allocationsByVolunteer[v.id] || []
    }));

    return NextResponse.json(volunteersWithResources);
  } catch {
    return NextResponse.json([]);
  }
}
