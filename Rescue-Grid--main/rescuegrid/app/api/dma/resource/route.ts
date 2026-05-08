import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    
    const { name, type, quantity, unit, low_stock_threshold, owner_info, location } = body;
    
    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }
    
    const insertData = {
      name,
      type,
      quantity: quantity || 0,
      unit: unit || null,
      low_stock_threshold: low_stock_threshold || 0,
      owner_info: owner_info || null,
      location: location || null,
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from("resource")
      .insert(insertData)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Create resource error:", err);
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 }
    );
  }
}
