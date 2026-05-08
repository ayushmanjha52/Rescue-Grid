import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id } = await params;

    // First delete any allocations for this resource (cascade delete)
    const { error: allocationError } = await supabase
      .from("resource_allocation")
      .delete()
      .eq("resource_id", id);

    if (allocationError) {
      console.error("Delete resource allocations error:", allocationError);
      return NextResponse.json({ error: allocationError.message }, { status: 400 });
    }

    // Then delete the resource
    const { error } = await supabase
      .from("resource")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete resource error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete resource error:", err);
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id } = await params;
    const body = await request.json();
    
    const { quantity } = body;
    
    if (quantity === undefined || quantity < 0) {
      return NextResponse.json(
        { error: "Valid quantity (>= 0) is required" },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from("resource")
      .update({ 
        quantity,
        updated_at: new Date().toISOString() 
      })
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error("Update resource error:", err);
    return NextResponse.json(
      { error: "Failed to update resource" },
      { status: 500 }
    );
  }
}
