import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    const { data: resources, error: resourcesError } = await supabase
      .from("resource")
      .select("*")
      .order("name");

    if (resourcesError) throw resourcesError;

    if (!resources || resources.length === 0) {
      return NextResponse.json([]);
    }

    const resourceIds = resources.map((r) => r.id);

    const { data: allocations, error: allocError } = await supabase
      .from("resource_allocation")
      .select("resource_id, quantity_allocated, status")
      .in("resource_id", resourceIds)
      .in("status", ["allocated", "in_use"]);

    if (allocError) {
      console.error("Allocations fetch error:", allocError);
    }

    const allocationMap = new Map<string, number>();
    if (allocations) {
      for (const alloc of allocations) {
        const current = allocationMap.get(alloc.resource_id) || 0;
        allocationMap.set(alloc.resource_id, current + alloc.quantity_allocated);
      }
    }

    const resourcesWithAlloc = resources.map((r) => ({
      ...r,
      quantity_allocated: allocationMap.get(r.id) || 0,
      quantity_available: r.quantity - (allocationMap.get(r.id) || 0),
    }));

    return NextResponse.json(resourcesWithAlloc);
  } catch (error) {
    console.error("Error fetching resources with allocations:", error);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}
