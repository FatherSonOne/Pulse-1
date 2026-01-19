-- =====================================================
-- FIX RLS POLICIES FOR 503 ERRORS
-- Run this in Supabase SQL Editor to fix HEAD request issues
-- =====================================================

-- Threads table
DROP POLICY IF EXISTS "Allow all access" ON threads;
CREATE POLICY "Enable all access" ON threads 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Calendar events table
DROP POLICY IF EXISTS "Allow all access" ON calendar_events;
CREATE POLICY "Enable all access" ON calendar_events 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Tasks table
DROP POLICY IF EXISTS "Allow all access" ON tasks;
CREATE POLICY "Enable all access" ON tasks 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Messages table
DROP POLICY IF EXISTS "Allow all access" ON messages;
CREATE POLICY "Enable all access" ON messages 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Unified messages table
DROP POLICY IF EXISTS "Allow all access" ON unified_messages;
CREATE POLICY "Enable all access" ON unified_messages 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify policies were created correctly
SELECT 
  schemaname, 
  tablename, 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('threads', 'calendar_events', 'tasks', 'messages', 'unified_messages')
ORDER BY tablename, policyname;

-- Check RLS is still enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('threads', 'calendar_events', 'tasks', 'messages', 'unified_messages');

SELECT '✅ RLS Policy fixes applied successfully!' as status;
