import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { ASSIGNMENT_DONE, ASSIGNMENT_IN_PROGRESS } from "@/lib/status";

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = createServiceClient();

    const count = async (statuses: readonly string[]) => {
      const { count, error } = await supabase
        .from("assignment")
        .select("id", { count: "exact", head: true })
        .in("status", statuses as string[]);
      if (error) throw error;
      return count ?? 0;
    };

    const [queue, active, duplicate, done] = await Promise.all([
      count(["open"]),
      count(ASSIGNMENT_IN_PROGRESS),
      count(["duplicate"]),
      count(ASSIGNMENT_DONE),
    ]);

    return NextResponse.json({ queue, active, duplicate, done });
  } catch (err) {
    console.error("Assignment counts error:", err);
    return NextResponse.json({ error: "Failed to load counts" }, { status: 500 });
  }
}
