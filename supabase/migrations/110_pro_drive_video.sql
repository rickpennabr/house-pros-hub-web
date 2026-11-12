-- Job camera clips. iPhone records video/quicktime or video/mp4.
UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT ARRAY(
    SELECT DISTINCT mime
    FROM unnest(allowed_mime_types || ARRAY['video/mp4', 'video/quicktime', 'video/webm']) AS mime
  )
)
WHERE id = 'pro-drive';
