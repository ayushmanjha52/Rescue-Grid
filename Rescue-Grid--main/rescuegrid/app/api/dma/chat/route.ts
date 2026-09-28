import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireDma } from '@/lib/auth/dma';
import {
  Agent,
  run,
  hostedMcpTool,
  setDefaultOpenAIKey,
  user,
  assistant,
  type AgentInputItem,
} from '@openai/agents';

const MAX_HISTORY_MESSAGES = 20;
const MAX_INPUT_LENGTH = 4000;
const DEFAULT_SESSION_TITLE = 'New Disaster Briefing';

const DRIS_SYSTEM_PROMPT = `You are DRIS (Disaster Response Intelligence System) Core - an integrated AI intelligence layer for Rescue Grid.

AVAILABLE DATA TABLES:
- victim_report: id, phone_no, latitude, longitude, city, district, situation (food/water/medical/rescue/shelter/missing), urgency (critical/urgent/moderate), status (open/verified/assigned/en_route/arrived/resolved/duplicate), custom_message, created_at
- volunteer: id, name, mobile_no, type, latitude, longitude, skills, equipment, tier (1-4), status (active/standby/on-mission/offline), last_seen
- volunteer_skills / skill_definitions / skill_categories: normalized volunteer skills
- assignment: id, task, location_label, latitude, longitude, urgency, status (open/active/en_route/arrived/completed/failed), assigned_to_volunteer, assigned_to_taskforce, victim_report_id, timer (deadline)
- task_force: id, name, status (active/dissolved), assignment_id
- task_force_member: id, task_force_id, volunteer_id, member_type, role
- resource: id, name, type, quantity, low_stock_threshold, unit, location
- resource_allocation: id, resource_id, assignment_id, task_force_id, volunteer_id, quantity_allocated, quantity_consumed, quantity_returned, status (allocated/in_use/consumed/returned/lost)
  Available stock = resource.quantity - SUM(quantity_allocated) of allocations with status allocated/in_use.

AVAILABLE MCP TOOLS (via Supabase MCP):
- execute_sql: Execute SQL queries against the database (READ-ONLY mode)
- list_tables: List all tables in the database

CORE CAPABILITIES:
1. Query disaster data using execute_sql tool
2. Analyze patterns in victim reports
3. Suggest resource allocations
4. Identify critical hotspots
5. Track responder status and availability

RULES:
1. ALWAYS use execute_sql tool to query data - never guess or make up data
2. Join victim_report with assignment to find who is helping victims
3. Prioritize 'critical' urgency reports first
4. Flag resources at or below low_stock_threshold as critical alerts
5. Calculate distances using latitude/longitude when asked about nearby responders (Haversine)
6. Use proper SQL syntax with table aliases for readability
7. You are read-only: recommend actions for the operator, never claim you performed them

RESPONSE STYLE:
- Be concise and tactical - this is a command center
- Use military/time-critical terminology when appropriate
- Highlight critical/urgent items with markers like [CRITICAL], [URGENT]
- Provide actionable intelligence, not raw data dumps
- When showing locations, reference district/city names
- Format SQL results in a readable way
`;

function createDRISAgent(): Agent {
  const supabaseMcp = hostedMcpTool({
    serverLabel: 'supabase',
    serverUrl: `https://mcp.supabase.com/mcp?project_ref=${process.env.SUPABASE_PROJECT_REF}&read_only=true`,
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
    },
  });

  return new Agent({
    name: 'DRIS_Core',
    instructions: DRIS_SYSTEM_PROMPT,
    tools: [supabaseMcp],
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function POST(req: Request) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const missingConfig = ['OPENAI_API_KEY', 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN'].filter(
    (key) => !process.env[key]
  );
  if (missingConfig.length > 0) {
    return textResponse(
      `DRIS is not configured on this server (missing ${missingConfig.join(', ')}).`,
      503
    );
  }

  const body = await req.json().catch(() => ({}));
  const sessionId: string | undefined = body.sessionId;
  const messages: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : [];
  const lastUserMessage = [...messages].reverse().find((m) => m?.role === 'user');
  const input = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content.trim() : '';

  if (!input) return textResponse('A question is required.', 400);
  if (input.length > MAX_INPUT_LENGTH) return textResponse(`Please keep questions under ${MAX_INPUT_LENGTH} characters.`, 400);

  const supabase = await createClient();

  // The session must belong to the logged-in operator (RLS enforces this too).
  let history: { role: string; content: string }[] = [];
  let sessionTitle: string | null = null;
  if (sessionId) {
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('id', sessionId)
      .eq('created_by', auth.user.id)
      .maybeSingle();
    if (!session) return textResponse('Briefing not found.', 404);
    sessionTitle = session.title;

    const { data: historyRows } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);
    history = (historyRows || []).reverse();
  }

  const agentInput: AgentInputItem[] = [
    ...history.map((m) => (m.role === 'user' ? user(m.content) : assistant(m.content))),
    user(input),
  ];

  if (sessionId) {
    await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: input });
    if (!sessionTitle || sessionTitle === DEFAULT_SESSION_TITLE) {
      // chat_sessions has no UPDATE policy for operators; ownership was verified above.
      const title = input.length > 60 ? `${input.slice(0, 57)}…` : input;
      await createServiceClient()
        .from('chat_sessions')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
  }

  setDefaultOpenAIKey(process.env.OPENAI_API_KEY!);
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        const streamResult = await run(createDRISAgent(), agentInput, { stream: true });

        for await (const value of streamResult.toTextStream()) {
          if (value) {
            fullResponse += value;
            controller.enqueue(encoder.encode(value));
          }
        }
        await streamResult.completed;
      } catch (error) {
        console.error('Chat API error:', error);
        const notice = '\n\n⚠ DRIS could not complete this request. Please try again.';
        fullResponse += notice;
        controller.enqueue(encoder.encode(notice));
      } finally {
        if (sessionId && fullResponse.trim()) {
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullResponse,
          });
        }
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
