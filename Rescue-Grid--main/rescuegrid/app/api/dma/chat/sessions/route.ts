import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireDma } from '@/lib/auth/dma';

interface SessionRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chat_messages: { count: number }[] | null;
}

export async function POST() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        title: 'New Disaster Briefing',
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        chat_messages (count)
      `)
      .eq('created_by', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const sessions = ((data || []) as SessionRow[]).map((s) => ({
      id: s.id,
      title: s.title,
      created_at: s.created_at,
      updated_at: s.updated_at,
      message_count: s.chat_messages?.[0]?.count || 0,
    }));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
