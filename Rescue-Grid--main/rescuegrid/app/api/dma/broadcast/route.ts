import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/push/sendPush";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    
    const { message, target, taskForceId } = body;
    
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    if (message.length > 500) {
      return NextResponse.json(
        { error: "Message must be 500 characters or less" },
        { status: 400 }
      );
    }
    
    const validTargets = ["all_volunteers", "specific_task_force", "everyone"];
    if (!target || !validTargets.includes(target)) {
      return NextResponse.json(
        { error: "Valid target is required" },
        { status: 400 }
      );
    }
    
    if (target === "specific_task_force" && !taskForceId) {
      return NextResponse.json(
        { error: "taskForceId is required for specific_task_force target" },
        { status: 400 }
      );
    }
    
    let volunteers: { id: string; push_token: string | null }[] = [];
    
    if (target === "all_volunteers") {
      const { data } = await supabase
        .from("volunteer")
        .select("id, push_token")
        .eq("status", "active");
      volunteers = data || [];
    } else if (target === "everyone") {
      const { data } = await supabase
        .from("volunteer")
        .select("id, push_token");
      volunteers = data || [];
    } else if (target === "specific_task_force") {
      const { data: members } = await supabase
        .from("task_force_member")
        .select("volunteer_id");
      
      if (members && members.length > 0) {
        const volunteerIds = members.map(m => m.volunteer_id).filter(Boolean);
        const { data: volData } = await supabase
          .from("volunteer")
          .select("id, push_token")
          .in("id", volunteerIds);
        volunteers = volData || [];
      }
    }
    
    const volunteerIds = volunteers.map(v => v.id);
    
    if (volunteerIds.length === 0) {
      return NextResponse.json(
        { error: "No recipients found" },
        { status: 400 }
      );
    }
    
    const messageRows = volunteerIds.map(volunteerId => ({
      content: message.trim(),
      sender_type: "dma",
      sender_id: null,
      receiver_id: volunteerId,
      task_force_id: null,
      victim_report_id: null,
      is_flagged_for_dma: false,
    }));
    
    const { error: insertError } = await supabase
      .from("message")
      .insert(messageRows);
    
    if (insertError) throw insertError;
    
    const pushTitle = "Emergency Broadcast";
    const pushBody = message.substring(0, 100);
    
    volunteers
      .filter(v => v.push_token)
      .forEach(v => {
        sendPush(v.push_token!, pushTitle, pushBody).catch(console.error);
      });
    
    return NextResponse.json({ 
      sent: volunteerIds.length,
      message: `Broadcast sent to ${volunteerIds.length} volunteers`
    }, { status: 201 });
  } catch (err) {
    console.error("Broadcast error:", err);
    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: 500 }
    );
  }
}
