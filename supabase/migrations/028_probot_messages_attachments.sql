-- Attachments on chat messages (images + PDFs). Stored as JSONB array.
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.probot_messages.attachments IS 'Array of { url, name, contentType } for images and PDFs (max 10 per message).';

-- Bucket "chat-attachments": create manually in Dashboard (Public, 10MB, MIME: image/jpeg, image/png, image/webp, application/pdf)
CREATE POLICY "Anyone can view chat attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');
