import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";

function nonNegative(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
    const quantity = nonNegative(body.quantity);
    const threshold = nonNegative(body.low_stock_threshold);

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }
    if (quantity === null || threshold === null) {
      return NextResponse.json({ error: "Quantity and threshold must be non-negative numbers" }, { status: 400 });
    }

    const optional = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;

    const { data, error } = await supabase
      .from("resource")
      .insert({
        name: name.slice(0, 120),
        type: type.slice(0, 50),
        quantity,
        unit: optional(body.unit),
        low_stock_threshold: threshold,
        owner_info: optional(body.owner_info),
        location: optional(body.location),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Create resource error:", err);
    return NextResponse.json({ error: "Failed to create resource" }, { status: 500 });
  }
}
