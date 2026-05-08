import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const statuses = ["open", "active", "duplicate", "completed", "failed"];

    const results = await Promise.all(
      statuses.map(async (status) => {
        const { count } = await supabase
          .from("assignment")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        return { status, count: count ?? 0 };
      })
    );

    const counters = {
      queue: 0,
      active: 0,
      duplicate: 0,
      done: 0,
    };

    results.forEach(({ status, count }) => {
      if (status === "open") counters.queue = count;
      else if (status === "active") counters.active = count;
      else if (status === "duplicate") counters.duplicate = count;
      else counters.done += count;
    });

    return NextResponse.json(counters);
  } catch {
    return NextResponse.json({ queue: 0, active: 0, duplicate: 0, done: 0 });
  }
}
