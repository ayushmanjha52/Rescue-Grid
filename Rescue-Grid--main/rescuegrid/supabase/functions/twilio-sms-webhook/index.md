import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "text/xml",
};

interface ParsedSMS {
  phone: string;
  latitude: number | null;
  longitude: number | null;
  situation: string;
  customMessage: string | null;
}

function parseSMSBody(body: string, fromPhone: string): ParsedSMS {
  const result: ParsedSMS = {
    phone: fromPhone,
    latitude: null,
    longitude: null,
    situation: "rescue",
    customMessage: null,
  };

  const phoneMatch = body.match(/Phone:\s*([\+\d\s\-\(\)]+)/i);
  if (phoneMatch) {
    result.phone = phoneMatch[1].replace(/\s/g, "");
  }

  const locationMatch = body.match(/Location:\s*([\d\.\-]+)\s*,\s*([\d\.\-]+)/i);
  if (locationMatch) {
    result.latitude = parseFloat(locationMatch[1]);
    result.longitude = parseFloat(locationMatch[2]);
  }

  const typeMatch = body.match(/Type:\s*(\w+)/i);
  if (typeMatch) {
    const type = typeMatch[1].toLowerCase();
    const validTypes = ["food", "water", "medical", "rescue", "shelter", "missing"];
    if (validTypes.includes(type)) {
      result.situation = type;
    }
  }

  const msgMatch = body.match(/Msg:\s*(.+)(?:\n|$)/is);
  if (msgMatch) {
    result.customMessage = msgMatch[1].trim();
    if (result.customMessage === "None" || result.customMessage === "N/A") {
      result.customMessage = null;
    }
  }

  return result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;

    console.log(`Incoming SMS from ${from} to ${to}: ${body}`);

    if (!body || !body.includes("RESCUEGRID")) {
      console.log("Not a RescueGrid SOS message, ignoring");
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
        { status: 200, headers: corsHeaders }
      );
    }

    const parsed = parseSMSBody(body, from);

    if (!parsed.latitude || !parsed.longitude) {
      console.error("Missing coordinates in SMS");
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Could not process: Missing location data</Message></Response>`,
        { status: 200, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("victim_report")
      .select("id")
      .eq("phone_no", parsed.phone)
      .gte("created_at", fiveMinutesAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log("Duplicate report detected, skipping");
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
        { status: 200, headers: corsHeaders }
      );
    }

    const urgencyMap: Record<string, string> = {
      rescue: "critical",
      medical: "critical",
      missing: "urgent",
      food: "urgent",
      water: "urgent",
      shelter: "moderate",
    };

    const { data: report, error } = await supabase
      .from("victim_report")
      .insert({
        phone_no: parsed.phone,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        situation: parsed.situation,
        custom_message: parsed.customMessage,
        status: "open",
        urgency: urgencyMap[parsed.situation] || "moderate",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`Created victim_report: ${report.id}`);

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
      { status: 200, headers: corsHeaders }
    );
  }
});
