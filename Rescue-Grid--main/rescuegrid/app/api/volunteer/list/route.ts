import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { ALLOCATION_ACTIVE } from "@/lib/status";

interface AllocationRow {
  id: string;
  volunteer_id: string;
  quantity_allocated: number;
  status: string;
  resource: { name: string; type: string; unit: string } | null;
}

/** DMA roster: every volunteer plus the resources they currently hold. */
export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data: volunteers, error } = await supabase
      .from("volunteer")
      .select("id, name, type, skills, status, last_seen, latitude, longitude, tier")
      .order("name");

    if (error) throw error;
    if (!volunteers || volunteers.length === 0) {
      return NextResponse.json([]);
    }

    const { data: allocations } = await supabase
      .from("resource_allocation")
      .select(`
        id, volunteer_id, quantity_allocated, status,
        resource:resource_id(name, type, unit)
      `)
      .not("volunteer_id", "is", null)
      .in("status", ALLOCATION_ACTIVE as unknown as string[]);

    const allocationsByVolunteer: Record<string, AllocationRow[]> = {};
    for (const alloc of (allocations || []) as unknown as AllocationRow[]) {
      (allocationsByVolunteer[alloc.volunteer_id] ||= []).push(alloc);
    }

    return NextResponse.json(
      volunteers.map((v) => ({
        ...v,
        resource_allocations: allocationsByVolunteer[v.id] || [],
      }))
    );
  } catch (err) {
    console.error("Volunteer list error:", err);
    return NextResponse.json({ error: "Failed to load volunteers" }, { status: 500 });
  }
}
