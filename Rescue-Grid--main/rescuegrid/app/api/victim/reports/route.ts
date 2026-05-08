import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("victim_report")
      .select("id, phone_no, latitude, longitude, city, district, situation, urgency, status, created_at, custom_message")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (phone) {
      const digitsOnly = phone.replace(/\D/g, "");
      const last10 = digitsOnly.slice(-10);
      const filtered = (data || []).filter((r) => {
        const dbDigits = r.phone_no.replace(/\D/g, "");
        return dbDigits.endsWith(last10);
      });
      return NextResponse.json({ reports: filtered }, { status: 200 });
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
