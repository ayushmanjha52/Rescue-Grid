import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";

export async function GET(request: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    let query = supabase
      .from("resource_allocation")
      .select(`
        *,
        resource:resource_id(name, type, unit),
        assignment:assignment_id(task),
        task_force:task_force_id(name),
        volunteer:volunteer_id(name)
      `)
      .order("allocated_at", { ascending: false })
      .limit(500);

    for (const field of ["resource_id", "assignment_id", "task_force_id", "volunteer_id", "status"] as const) {
      const value = searchParams.get(field);
      if (value) query = query.eq(field, value);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("List allocations error:", err);
    return NextResponse.json({ error: "Failed to list allocations" }, { status: 500 });
  }
}
