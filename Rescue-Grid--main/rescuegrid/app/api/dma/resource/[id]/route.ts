import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { getReservedQuantity } from "@/lib/resources";
import { ALLOCATION_ACTIVE } from "@/lib/status";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const { id } = await params;

    // Refuse to delete stock that is still out in the field.
    const { count } = await supabase
      .from("resource_allocation")
      .select("id", { count: "exact", head: true })
      .eq("resource_id", id)
      .in("status", ALLOCATION_ACTIVE as unknown as string[]);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: `${count} allocation(s) are still active. Settle them before deleting this resource.` },
        { status: 409 }
      );
    }

    const { error: allocationError } = await supabase
      .from("resource_allocation")
      .delete()
      .eq("resource_id", id);

    if (allocationError) throw allocationError;

    const { error } = await supabase.from("resource").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete resource error:", err);
    return NextResponse.json({ error: "Failed to delete resource" }, { status: 500 });
  }
}

/** Updates stock level and/or metadata of a resource. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        return NextResponse.json({ error: "Valid quantity (>= 0) is required" }, { status: 400 });
      }
      const reserved = await getReservedQuantity(supabase, id);
      if (quantity < reserved) {
        return NextResponse.json(
          { error: `Quantity can't be below the ${reserved} currently allocated` },
          { status: 400 }
        );
      }
      updates.quantity = quantity;
    }

    if (body.low_stock_threshold !== undefined) {
      const threshold = Number(body.low_stock_threshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        return NextResponse.json({ error: "Threshold must be >= 0" }, { status: 400 });
      }
      updates.low_stock_threshold = threshold;
    }

    for (const field of ["name", "type", "unit", "owner_info", "location"] as const) {
      if (typeof body[field] === "string") {
        const value = body[field].trim();
        if ((field === "name" || field === "type") && !value) {
          return NextResponse.json({ error: `${field} cannot be empty` }, { status: 400 });
        }
        updates[field] = value ? value.slice(0, 200) : null;
      }
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("resource")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Update resource error:", err);
    return NextResponse.json({ error: "Failed to update resource" }, { status: 500 });
  }
}
