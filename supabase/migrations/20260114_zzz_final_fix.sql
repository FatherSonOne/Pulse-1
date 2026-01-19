-- Final fix for all table schema issues
-- This migration ensures all tables have required columns for RLS policies

-- Fix integrations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'user_id') THEN
      ALTER TABLE integrations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added user_id to integrations';
    END IF;
  END IF;
END $$;

-- Ensure contacts has user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'user_id') THEN
      ALTER TABLE contacts ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Ensure channels table has user_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'user_id') THEN
      ALTER TABLE channels ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added user_id column to channels';
    END IF;
  END IF;
END $$;

-- RLS Policies: Users can only access their own data (use IF NOT EXISTS pattern with error handling)
DO $$
BEGIN
  -- Skip policies if columns don't exist yet
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_policy') THEN
      BEGIN
        EXECUTE 'CREATE POLICY users_policy ON users FOR ALL USING (auth.uid() = id)';
      EXCEPTION WHEN duplicate_object THEN
        NULL; -- Policy already exists, ignore
      END;
    END IF;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'integrations_policy') THEN
    BEGIN
      EXECUTE 'CREATE POLICY integrations_policy ON integrations FOR ALL USING (user_id = auth.uid())';
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'Skipping integrations_policy - user_id column missing';
    END;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'contacts_policy') THEN
    EXECUTE 'CREATE POLICY contacts_policy ON contacts FOR ALL USING (user_id = auth.uid())';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channels' AND policyname = 'channels_policy') THEN
    EXECUTE 'CREATE POLICY channels_policy ON channels FOR ALL USING (user_id = auth.uid())';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unified_messages' AND policyname = 'messages_policy') THEN
    EXECUTE 'CREATE POLICY messages_policy ON unified_messages FOR ALL USING (user_id = auth.uid())';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_graphs' AND policyname = 'graphs_policy') THEN
    EXECUTE 'CREATE POLICY graphs_policy ON conversation_graphs FOR ALL USING (user_id = auth.uid())';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Some policies could not be created: %', SQLERRM;
END $$;