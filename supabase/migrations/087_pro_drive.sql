-- ProDrive: personal and business file catalog on private Storage.
-- Paths: user/{userId}/{fileId}.ext | business/{businessId}/{fileId}.ext

CREATE TABLE IF NOT EXISTS public.pro_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'business')),
  owner_id UUID NOT NULL,
  parent_id UUID REFERENCES public.pro_drive_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_drive_folders_name_not_blank CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_pro_drive_folders_owner
  ON public.pro_drive_folders (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_drive_folders_parent
  ON public.pro_drive_folders (parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS pro_drive_folders_sibling_name
  ON public.pro_drive_folders (
    owner_type,
    owner_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

CREATE TABLE IF NOT EXISTS public.pro_drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'business')),
  owner_id UUID NOT NULL,
  folder_id UUID REFERENCES public.pro_drive_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_path TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_drive_files_name_not_blank CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_pro_drive_files_owner
  ON public.pro_drive_files (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_drive_files_folder
  ON public.pro_drive_files (folder_id);

CREATE OR REPLACE FUNCTION public.pro_drive_owns_owner(p_owner_type TEXT, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_owner_type = 'user' THEN p_owner_id = auth.uid()
    WHEN p_owner_type = 'business' THEN EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = p_owner_id
        AND businesses.owner_id = auth.uid()
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.pro_drive_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pro_drive_folders_updated_at ON public.pro_drive_folders;
CREATE TRIGGER pro_drive_folders_updated_at
  BEFORE UPDATE ON public.pro_drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.pro_drive_set_updated_at();

DROP TRIGGER IF EXISTS pro_drive_files_updated_at ON public.pro_drive_files;
CREATE TRIGGER pro_drive_files_updated_at
  BEFORE UPDATE ON public.pro_drive_files
  FOR EACH ROW EXECUTE FUNCTION public.pro_drive_set_updated_at();

ALTER TABLE public.pro_drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_drive_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_drive_folders_select" ON public.pro_drive_folders;
CREATE POLICY "pro_drive_folders_select" ON public.pro_drive_folders
  FOR SELECT TO authenticated
  USING (public.pro_drive_owns_owner(owner_type, owner_id));

DROP POLICY IF EXISTS "pro_drive_folders_insert" ON public.pro_drive_folders;
CREATE POLICY "pro_drive_folders_insert" ON public.pro_drive_folders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pro_drive_owns_owner(owner_type, owner_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "pro_drive_folders_update" ON public.pro_drive_folders;
CREATE POLICY "pro_drive_folders_update" ON public.pro_drive_folders
  FOR UPDATE TO authenticated
  USING (public.pro_drive_owns_owner(owner_type, owner_id))
  WITH CHECK (public.pro_drive_owns_owner(owner_type, owner_id));

DROP POLICY IF EXISTS "pro_drive_folders_delete" ON public.pro_drive_folders;
CREATE POLICY "pro_drive_folders_delete" ON public.pro_drive_folders
  FOR DELETE TO authenticated
  USING (public.pro_drive_owns_owner(owner_type, owner_id));

DROP POLICY IF EXISTS "pro_drive_files_select" ON public.pro_drive_files;
CREATE POLICY "pro_drive_files_select" ON public.pro_drive_files
  FOR SELECT TO authenticated
  USING (public.pro_drive_owns_owner(owner_type, owner_id));

DROP POLICY IF EXISTS "pro_drive_files_insert" ON public.pro_drive_files;
CREATE POLICY "pro_drive_files_insert" ON public.pro_drive_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pro_drive_owns_owner(owner_type, owner_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "pro_drive_files_update" ON public.pro_drive_files;
CREATE POLICY "pro_drive_files_update" ON public.pro_drive_files
  FOR UPDATE TO authenticated
  USING (public.pro_drive_owns_owner(owner_type, owner_id))
  WITH CHECK (public.pro_drive_owns_owner(owner_type, owner_id));

DROP POLICY IF EXISTS "pro_drive_files_delete" ON public.pro_drive_files;
CREATE POLICY "pro_drive_files_delete" ON public.pro_drive_files
  FOR DELETE TO authenticated
  USING (public.pro_drive_owns_owner(owner_type, owner_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pro-drive',
  'pro-drive',
  false,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "pro drive select" ON storage.objects;
CREATE POLICY "pro drive select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pro-drive'
  AND (
    (
      (storage.foldername(name))[1] = 'user'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'business'
      AND EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id::text = (storage.foldername(name))[2]
          AND businesses.owner_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "pro drive insert" ON storage.objects;
CREATE POLICY "pro drive insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pro-drive'
  AND (
    (
      (storage.foldername(name))[1] = 'user'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'business'
      AND EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id::text = (storage.foldername(name))[2]
          AND businesses.owner_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "pro drive update" ON storage.objects;
CREATE POLICY "pro drive update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pro-drive'
  AND (
    (
      (storage.foldername(name))[1] = 'user'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'business'
      AND EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id::text = (storage.foldername(name))[2]
          AND businesses.owner_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'pro-drive'
  AND (
    (
      (storage.foldername(name))[1] = 'user'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'business'
      AND EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id::text = (storage.foldername(name))[2]
          AND businesses.owner_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "pro drive delete" ON storage.objects;
CREATE POLICY "pro drive delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pro-drive'
  AND (
    (
      (storage.foldername(name))[1] = 'user'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'business'
      AND EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id::text = (storage.foldername(name))[2]
          AND businesses.owner_id = auth.uid()
      )
    )
  )
);
