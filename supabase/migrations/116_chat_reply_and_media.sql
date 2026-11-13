-- Reply quotes, and room in the chat bucket for video and voice notes.

ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS reply_to JSONB;

COMMENT ON COLUMN public.probot_messages.reply_to IS
  'Snapshot of the message this one answers: { id, sender, body, kind }.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = 26214400,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
