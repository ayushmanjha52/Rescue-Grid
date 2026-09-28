import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { AllocationError, updateAllocation } from "@/lib/resources";
import { isAllocationStatus } from "@/lib/status";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const { id } = await params;
    const { status, quantity_consumed, quantity_returned, notes } = await request.json().catch(() => ({}));

    if (!isAllocationStatus(status)) {
      return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
    }

    const data = await updateAllocation(supabase, id, {
      status,
      quantity_consumed,
      quantity_returned,
      notes: typeof notes === "string" ? notes.slice(0, 500) : undefined,
    });

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AllocationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update allocation error:", err);
    return NextResponse.json({ error: "Failed to update allocation" }, { status: 500 });
  }
}
