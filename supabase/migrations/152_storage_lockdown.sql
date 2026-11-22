-- Security audit 2026-11-20: storage lockdown.
--
-- Public buckets serve files by URL without any storage.objects policy. The old
-- "anyone can view <bucket>" SELECT policies only added the ability to LIST every file in the
-- bucket, so anyone with the public anon key could enumerate and download every chat
-- attachment, home photo and estimate photo. estimate-images also let anyone INSERT and DELETE.
--
-- This migration:
-- 1. Drops every storage.objects policy (any command) whose only condition is
--    "bucket_id = '<a public bucket>'", i.e. open to everyone.
-- 2. Adds one owner-only SELECT policy so a signed-in user can still read (and therefore
--    overwrite/delete, which storage needs) files in their own folder: the first path segment
--    is their user id or a business they own.
-- The app's server routes upload with the service role, which bypasses these policies.
-- Private buckets (pro-drive, customer-documents) are not touched.

DO $$
DECLARE
  pol record;
  open_bucket text;
BEGIN
  FOR pol IN
    SELECT p.policyname, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
  LOOP
    open_bucket := coalesce(
      substring(coalesce(pol.qual, '') from '^\(?bucket_id = ''([a-z0-9-]+)''::text\)?$'),
      substring(coalesce(pol.with_check, '') from '^\(?bucket_id = ''([a-z0-9-]+)''::text\)?$')
    );
    IF open_bucket IS NOT NULL
       AND EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = open_bucket AND b.public) THEN
      RAISE NOTICE 'Dropping open storage policy "%" (bucket %)', pol.policyname, open_bucket;
      EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Owners read own files in public buckets" ON storage.objects;
CREATE POLICY "Owners read own files in public buckets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN (SELECT b.id FROM storage.buckets b WHERE b.public)
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id::text = (storage.foldername(name))[1]
          AND businesses.owner_id = auth.uid()
      )
    )
  );
