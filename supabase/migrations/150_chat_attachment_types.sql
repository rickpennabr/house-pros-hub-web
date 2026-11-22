-- Chat attachments accept what AI chat apps accept, minus anything that can run code.
-- The upload route sniffs each file's bytes (lib/utils/fileValidation.ts,
-- ALLOWED_CHAT_ATTACHMENT_TYPES); this bucket list is the second gate and must match it.
-- Never allowed: SVG, HTML, XML, scripts, macro-enabled or old binary Office, archives, programs.

UPDATE storage.buckets
SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/matroska',
    'video/vnd.avi',
    'video/3gpp',
    'audio/webm',
    'audio/mp4',
    'audio/x-m4a',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/aac',
    'audio/flac'
  ]
WHERE id = 'chat-attachments';
