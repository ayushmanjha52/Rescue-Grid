import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { ALLOCATION_ACTIVE } from "@/lib/status";

/** Inventory with how much of each resource is reserved by active allocations. */
export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

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

    const { data: allocations, error: allocError } = await supabase
      .from("resource_allocation")
      .select("resource_id, quantity_allocated")
      .in("resource_id", resources.map((r) => r.id))
      .in("status", ALLOCATION_ACTIVE as unknown as string[]);

    if (allocError) throw allocError;

    const reserved = new Map<string, number>();
    for (const alloc of allocations || []) {
      reserved.set(alloc.resource_id, (reserved.get(alloc.resource_id) || 0) + (Number(alloc.quantity_allocated) || 0));
    }

    return NextResponse.json(
      resources.map((r) => ({
        ...r,
        quantity_allocated: reserved.get(r.id) || 0,
        quantity_available: Math.max((Number(r.quantity) || 0) - (reserved.get(r.id) || 0), 0),
      }))
    );
  } catch (error) {
    console.error("Error fetching resources with allocations:", error);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}
