-- ============================================
-- Migration 005: Create csrf_tokens table
-- ============================================
-- This table stores CSRF tokens to prevent hot reload issues in development
-- and support multi-instance deployments in production

CREATE TABLE IF NOT EXISTS csrf_tokens (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, token)
);

-- Index for efficient lookups by user_id
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user_id ON csrf_tokens(user_id);

-- Index for efficient cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

-- Enable RLS
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for csrf_tokens
-- Users can only manage their own CSRF tokens
CREATE POLICY "Users can manage own CSRF tokens"
  ON csrf_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Function to automatically clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM csrf_tokens
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: In production, you may want to set up a cron job to call this function periodically
-- For now, we'll rely on the application to clean up expired tokens on access

