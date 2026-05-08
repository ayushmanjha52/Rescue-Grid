-- Chat Sessions for disaster event threads
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text DEFAULT 'New Disaster Briefing',
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Chat Messages with full context persistence
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_by ON public.chat_sessions(created_by);

-- RLS Policies
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.chat_sessions
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert own sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own sessions" ON public.chat_sessions
    FOR DELETE USING (created_by = auth.uid());

CREATE POLICY "Users can view messages in their sessions" ON public.chat_messages
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM public.chat_sessions WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their sessions" ON public.chat_messages
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT id FROM public.chat_sessions WHERE created_by = auth.uid()
        )
    );

-- Trigger to update session timestamp
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_sessions 
    SET updated_at = now() 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_timestamp ON public.chat_messages;
CREATE TRIGGER trigger_update_session_timestamp
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_session_timestamp();
