-- ============================================
-- Migration 012: Create Incoming Emails Table
-- ============================================
-- 
-- This migration creates the incoming_emails table to store emails
-- received via webhook (e.g., from Resend Inbound).
-- ============================================

-- Create incoming_emails table
CREATE TABLE IF NOT EXISTS public.incoming_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email metadata
  message_id TEXT UNIQUE, -- Unique message ID from email service
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL, -- The email address that received this (e.g., legal@houseproshub.com)
  subject TEXT,
  
  -- Email content
  text_content TEXT,
  html_content TEXT,
  
  -- Attachments (stored as JSONB array of {filename, content_type, url})
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Email headers (stored as JSONB for flexibility)
  headers JSONB DEFAULT '{}'::jsonb,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'processed', 'failed', 'archived')),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- User reference (if email is from a known user)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_incoming_emails_message_id ON public.incoming_emails USING btree (message_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_to_email ON public.incoming_emails USING btree (to_email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_from_email ON public.incoming_emails USING btree (from_email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_status ON public.incoming_emails USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_received_at ON public.incoming_emails USING btree (received_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_user_id ON public.incoming_emails USING btree (user_id) TABLESPACE pg_default;

-- GIN index for JSONB fields (for efficient queries on attachments and headers)
CREATE INDEX IF NOT EXISTS idx_incoming_emails_attachments ON public.incoming_emails USING gin (attachments) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_headers ON public.incoming_emails USING gin (headers) TABLESPACE pg_default;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_incoming_emails_updated_at
  BEFORE UPDATE ON public.incoming_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.incoming_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Users can view emails sent to addresses they own (if linked via user_id)
CREATE POLICY "Users can view own incoming emails"
  ON public.incoming_emails FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all emails (for webhook processing)
-- Note: This is handled via service role client in API routes, not RLS
-- But we need a policy for service role operations
CREATE POLICY "Service role can manage all incoming emails"
  ON public.incoming_emails FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.incoming_emails IS 'Stores incoming emails received via webhook (e.g., Resend Inbound)';
COMMENT ON COLUMN public.incoming_emails.message_id IS 'Unique message ID from email service (prevents duplicates)';
COMMENT ON COLUMN public.incoming_emails.to_email IS 'The email address that received this message (e.g., legal@houseproshub.com)';
COMMENT ON COLUMN public.incoming_emails.attachments IS 'JSONB array of attachment objects: [{filename, content_type, url, size}]';
COMMENT ON COLUMN public.incoming_emails.headers IS 'JSONB object containing email headers';
COMMENT ON COLUMN public.incoming_emails.status IS 'Processing status: new, processing, processed, failed, archived';
