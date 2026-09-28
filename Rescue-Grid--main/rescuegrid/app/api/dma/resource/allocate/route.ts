import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { getReservedQuantity } from "@/lib/resources";
import { sendPushToVolunteers } from "@/lib/push/sendPush";
import { getAssignmentRecipients } from "@/lib/assignments";

export async function POST(request: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));
    const { resource_id, assignment_id, task_force_id, volunteer_id } = body;
    const quantity = Number(body.quantity);

    if (!resource_id || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Resource ID and positive quantity are required" },
        { status: 400 }
      );
    }

    const targets = [assignment_id, task_force_id, volunteer_id].filter(Boolean);
    if (targets.length !== 1) {
      return NextResponse.json(
        { error: "Specify exactly one target: assignment_id, task_force_id, or volunteer_id" },
        { status: 400 }
      );
    }

    const { data: resource } = await supabase
      .from("resource")
      .select("quantity, name, unit")
      .eq("id", resource_id)
      .maybeSingle();

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const available = (Number(resource.quantity) || 0) - (await getReservedQuantity(supabase, resource_id));

    if (quantity > available) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${Math.max(available, 0)}` },
        { status: 400 }
      );
    }

    const { data: allocation, error } = await supabase
      .from("resource_allocation")
      .insert({
        resource_id,
        quantity_allocated: quantity,
        status: "allocated",
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null,
        allocated_by: auth.user.id,
        assignment_id: assignment_id || null,
        task_force_id: task_force_id || null,
        volunteer_id: volunteer_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from("resource")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", resource_id);

    // Let the people receiving the stock know it's coming.
    let recipients: string[] = [];
    if (volunteer_id) {
      recipients = [volunteer_id];
    } else if (task_force_id) {
      recipients = await getAssignmentRecipients(supabase, { assigned_to_volunteer: null, assigned_to_taskforce: task_force_id });
    } else if (assignment_id) {
      const { data: assignment } = await supabase
        .from("assignment")
        .select("assigned_to_volunteer, assigned_to_taskforce")
        .eq("id", assignment_id)
        .maybeSingle();
      if (assignment) recipients = await getAssignmentRecipients(supabase, assignment);
    }
    await sendPushToVolunteers(
      supabase,
      recipients,
      "📦 Resources allocated",
      `${quantity} ${resource.unit || ""} ${resource.name}`.replace(/\s+/g, " ").trim(),
      "/volunteer/resources"
    );

    return NextResponse.json(allocation, { status: 201 });
  } catch (err) {
    console.error("Allocate resource error:", err);
    return NextResponse.json({ error: "Failed to allocate resource" }, { status: 500 });
  }
}
