-- Fix RLS policy for ai_thinking_logs to allow inserts
DROP POLICY IF EXISTS "Users can view thinking logs for own sessions" ON ai_thinking_logs;

CREATE POLICY "Users can view thinking logs for own sessions" ON ai_thinking_logs
  FOR SELECT USING (
    exists (
      select 1 from ai_messages 
      join ai_sessions on ai_messages.session_id = ai_sessions.id
      where ai_messages.id = ai_thinking_logs.message_id 
      and ai_sessions.user_id = auth.uid()
    )
  );

-- Add insert policy for thinking logs
CREATE POLICY "Users can insert thinking logs for own messages" ON ai_thinking_logs
  FOR INSERT WITH CHECK (
    exists (
      select 1 from ai_messages 
      join ai_sessions on ai_messages.session_id = ai_sessions.id
      where ai_messages.id = message_id 
      and ai_sessions.user_id = auth.uid()
    )
  );
