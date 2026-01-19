-- Temporary: Disable RLS for testing
-- WARNING: This is for local development only!
-- In production, you should use proper RLS policies with authenticated users

-- Disable RLS on all tables for testing
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE unified_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_graphs DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_sync_state DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled but allow all operations for testing:
-- DROP POLICY IF EXISTS "Users can manage their own data" ON users;
-- DROP POLICY IF EXISTS "Users can manage their own integrations" ON integrations;
-- DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
-- DROP POLICY IF EXISTS "Users can manage their own channels" ON channels;
-- DROP POLICY IF EXISTS "Users can manage their own messages" ON unified_messages;
-- DROP POLICY IF EXISTS "Users can manage their own graphs" ON conversation_graphs;
-- DROP POLICY IF EXISTS "Users can manage their own sync state" ON message_sync_state;

-- CREATE POLICY "Allow all for testing" ON users FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for testing" ON integrations FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for testing" ON contacts FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for testing" ON channels FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for testing" ON unified_messages FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for testing" ON conversation_graphs FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for testing" ON message_sync_state FOR ALL USING (true) WITH CHECK (true);
