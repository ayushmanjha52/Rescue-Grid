import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id } = await params;
    const body = await request.json();
    
    const { status, quantity_consumed, quantity_returned, notes } = body;
    
    const validStatuses = ["allocated", "in_use", "consumed", "returned", "lost"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required" },
        { status: 400 }
      );
    }
    
    const updateData: Record<string, unknown> = { 
      status,
      updated_at: new Date().toISOString() 
    };
    
    if (quantity_consumed !== undefined) updateData.quantity_consumed = quantity_consumed;
    if (quantity_returned !== undefined) updateData.quantity_returned = quantity_returned;
    if (notes !== undefined) updateData.notes = notes;
    
    const { data, error } = await supabase
      .from("resource_allocation")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        resource:resource_id(name)
      `)
      .single();
    
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Allocation not found" },
        { status: 404 }
      );
    }
    
    if (status === "returned" && quantity_returned && data.resource_id) {
      try {
        await supabase.rpc("increment_resource_quantity", {
          resource_id: data.resource_id,
          amount: quantity_returned,
        });
      } catch {
        console.log("RPC not available, skipping quantity increment");
      }
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error("Update allocation error:", err);
    return NextResponse.json(
      { error: "Failed to update allocation" },
      { status: 500 }
    );
  }
}
