import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("resource")
      .select("*")
      .order("name");

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Resource list error:", err);
    return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
  }
}
