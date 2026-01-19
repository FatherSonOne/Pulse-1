-- Migration: Public API Keys System
-- Enables programmatic access to Pulse via REST API

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (e.g., "pk_live_")
  key_hash TEXT NOT NULL, -- Hashed full key for security
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'], -- read, write, delete, admin
  rate_limit INTEGER NOT NULL DEFAULT 100, -- requests per minute
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- NULL means never expires
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- API request logs for analytics and rate limiting
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limit tracking (sliding window)
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(api_key_id, window_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_request_logs_key_id ON api_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user_id ON api_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created ON api_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_window ON api_rate_limits(api_key_id, window_start);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys
CREATE POLICY "Users can view their own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for api_request_logs
CREATE POLICY "Users can view their own API request logs"
  ON api_request_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert logs (from edge functions)
CREATE POLICY "Service role can insert logs"
  ON api_request_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for api_rate_limits
CREATE POLICY "Users can view their own rate limits"
  ON api_rate_limits FOR SELECT
  USING (
    api_key_id IN (SELECT id FROM api_keys WHERE user_id = auth.uid())
  );

-- Function to validate API key and check rate limits
CREATE OR REPLACE FUNCTION validate_api_key(
  p_api_key TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_id UUID,
  key_id UUID,
  scopes TEXT[],
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_prefix TEXT;
  v_key_hash TEXT;
  v_api_key api_keys%ROWTYPE;
  v_window_start TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  -- Extract prefix (first 12 chars including "pk_live_" or "pk_test_")
  v_key_prefix := LEFT(p_api_key, 12);

  -- Hash the full key for comparison
  v_key_hash := encode(sha256(p_api_key::bytea), 'hex');

  -- Find the API key
  SELECT * INTO v_api_key
  FROM api_keys
  WHERE key_hash = v_key_hash
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF v_api_key IS NULL THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      NULL::UUID,
      NULL::UUID,
      NULL::TEXT[],
      'Invalid or expired API key'::TEXT;
    RETURN;
  END IF;

  -- Check rate limit (per-minute sliding window)
  v_window_start := date_trunc('minute', NOW());

  SELECT request_count INTO v_request_count
  FROM api_rate_limits
  WHERE api_key_id = v_api_key.id
    AND window_start = v_window_start;

  IF v_request_count IS NOT NULL AND v_request_count >= v_api_key.rate_limit THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      v_api_key.user_id,
      v_api_key.id,
      v_api_key.scopes,
      'Rate limit exceeded. Try again in a minute.'::TEXT;
    RETURN;
  END IF;

  -- Increment rate limit counter
  INSERT INTO api_rate_limits (api_key_id, window_start, request_count)
  VALUES (v_api_key.id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1;

  -- Update last used timestamp
  UPDATE api_keys
  SET last_used_at = NOW(), updated_at = NOW()
  WHERE id = v_api_key.id;

  -- Return success
  RETURN QUERY SELECT
    true::BOOLEAN,
    v_api_key.user_id,
    v_api_key.id,
    v_api_key.scopes,
    NULL::TEXT;
END;
$$;

-- Function to generate a new API key (returns the unhashed key only once)
CREATE OR REPLACE FUNCTION generate_api_key(
  p_user_id UUID,
  p_name TEXT,
  p_scopes TEXT[] DEFAULT ARRAY['read'],
  p_rate_limit INTEGER DEFAULT 100,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  key_id UUID,
  api_key TEXT,
  key_prefix TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id UUID;
  v_random_part TEXT;
  v_full_key TEXT;
  v_prefix TEXT;
  v_hash TEXT;
BEGIN
  -- Generate random key part (32 chars)
  v_random_part := encode(gen_random_bytes(24), 'base64');
  v_random_part := replace(replace(replace(v_random_part, '+', ''), '/', ''), '=', '');
  v_random_part := LEFT(v_random_part, 32);

  -- Create full key with prefix
  v_prefix := 'pk_live_';
  v_full_key := v_prefix || v_random_part;

  -- Hash for storage
  v_hash := encode(sha256(v_full_key::bytea), 'hex');

  -- Insert the key
  INSERT INTO api_keys (
    user_id,
    name,
    key_prefix,
    key_hash,
    scopes,
    rate_limit,
    expires_at
  )
  VALUES (
    p_user_id,
    p_name,
    LEFT(v_full_key, 12),
    v_hash,
    p_scopes,
    p_rate_limit,
    p_expires_at
  )
  RETURNING id INTO v_key_id;

  -- Return the key (only time it's visible unhashed)
  RETURN QUERY SELECT
    v_key_id,
    v_full_key,
    LEFT(v_full_key, 12);
END;
$$;

-- Cleanup old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM api_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- Cleanup old request logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_request_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM api_request_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_api_key(UUID, TEXT, TEXT[], INTEGER, TIMESTAMPTZ) TO authenticated;
