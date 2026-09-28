import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireDma } from '@/lib/auth/dma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('created_by', auth.user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', id)
    .eq('created_by', auth.user.id);

  if (error) {
    console.error('Delete session error:', error);
    return NextResponse.json({ error: 'Failed to delete briefing' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
