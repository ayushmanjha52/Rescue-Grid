import { createClient } from '@/lib/supabase/server';
import { 
  Agent, 
  run,
  hostedMcpTool,
} from '@openai/agents';
import { setDefaultOpenAIKey } from '@openai/agents';

setDefaultOpenAIKey(process.env.OPENAI_API_KEY!);

const DRIS_SYSTEM_PROMPT = `You are DRIS (Disaster Response Intelligence System) Core - an integrated AI intelligence layer for Rescue Grid.

AVAILABLE DATA TABLES:
- victim_report: id, phone_no, latitude, longitude, city, district, situation, urgency (critical/urgent/moderate), status (open/verified/assigned/en_route/arrived/resolved/duplicate), custom_message, created_at
- volunteer: id, name, mobile_no, type, latitude, longitude, skills, equipment, status (active/standby/on-mission), last_seen
- assignment: id, task, location_label, latitude, longitude, urgency, status (open/active/completed/failed), assigned_to_volunteer, assigned_to_taskforce, victim_report_id
- task_force: id, name, status, dma_id
- task_force_member: id, task_force_id, volunteer_id, member_type, role
- resource: id, name, type, quantity, low_stock_threshold, unit
- resource_allocation: id, resource_id, assignment_id, quantity_allocated, status

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
5. Calculate distances using latitude/longitude when asked about nearby responders
6. Use proper SQL syntax with table aliases for readability

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

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  let fullResponse = '';

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        const { messages, sessionId } = await req.json();
        const supabase = await createClient();

        const { data: historyMessages } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage?.role === 'user' && sessionId) {
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: lastUserMessage.content,
          });
        }

        const agent = createDRISAgent();
        const input = lastUserMessage?.content || '';

        const streamResult = await run(agent, input, {
          stream: true,
        });

        const textStream = streamResult.toTextStream();
        const reader = (textStream as unknown as { getReader(): { read(): Promise<{ done: boolean; value?: string }> } }).getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += value || '';
          controller.enqueue(new TextEncoder().encode(value || ''));
        }

        if (sessionId && fullResponse) {
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullResponse,
          });
        }

        controller.close();
      } catch (error) {
        console.error('Chat API error:', error);
        controller.enqueue(encoder.encode('Error: Failed to process request'));
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    },
  });
}
