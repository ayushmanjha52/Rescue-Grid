import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDma } from "@/lib/auth/dma";
import { sanitizeFilterTerm } from "@/lib/skills";
import { resolveSkillCodes, volunteerIdsWithSkills } from "@/lib/volunteerSearch";

/** Name / skill / equipment search over the volunteer roster (DMA only). */
export async function GET(request: NextRequest) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);

  const query = sanitizeFilterTerm(searchParams.get("q") || "");
  const skillCodes = searchParams.get("skills")?.split(",").filter(Boolean) || [];
  const equipment = (searchParams.get("equipment")?.split(",") || []).map(sanitizeFilterTerm).filter(Boolean);
  const status = searchParams.get("status") || "active";
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 50);
  const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  try {
    let supabaseQuery = supabase
      .from("volunteer")
      .select("id, name, type, latitude, longitude, skills, equipment, status, last_seen, tier", { count: "exact" });

    if (status && status !== "all") {
      supabaseQuery = supabaseQuery.eq("status", status);
    }

    if (query) {
      supabaseQuery = supabaseQuery.ilike("name", `%${query}%`);
    }

    if (skillCodes.length > 0) {
      const matching = await volunteerIdsWithSkills(supabase, await resolveSkillCodes(supabase, skillCodes));
      if (matching.size === 0) {
        return NextResponse.json({ data: [], total: 0, limit, offset, hasMore: false });
      }
      supabaseQuery = supabaseQuery.in("id", [...matching]);
    }

    if (equipment.length > 0) {
      supabaseQuery = supabaseQuery.or(equipment.map((e) => `equipment.ilike.%${e}%`).join(","));
    }

    const { data, error, count } = await supabaseQuery
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Volunteer search error:", error);
      return NextResponse.json({ error: "Failed to search volunteers" }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (err) {
    console.error("Volunteer search error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
