import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    
    const target = searchParams.get("target");
    const taskForceId = searchParams.get("taskForceId");
    
    if (!target) {
      return NextResponse.json(
        { error: "Target parameter is required" },
        { status: 400 }
      );
    }
    
    let count = 0;
    
    if (target === "all_volunteers") {
      const { count: volunteerCount } = await supabase
        .from("volunteer")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      count = volunteerCount || 0;
    } else if (target === "everyone") {
      const { count: allCount } = await supabase
        .from("volunteer")
        .select("*", { count: "exact", head: true });
      count = allCount || 0;
    } else if (target === "specific_task_force") {
      if (!taskForceId) {
        return NextResponse.json(
          { error: "taskForceId is required for specific_task_force target" },
          { status: 400 }
        );
      }
      const { count: tfCount } = await supabase
        .from("task_force_member")
        .select("*", { count: "exact", head: true })
        .eq("task_force_id", taskForceId);
      count = tfCount || 0;
    } else {
      return NextResponse.json(
        { error: "Invalid target" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ count });
  } catch (err) {
    console.error("Broadcast preview error:", err);
    return NextResponse.json(
      { error: "Failed to get recipient count" },
      { status: 500 }
    );
  }
}
