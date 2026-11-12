-- Project manager is a built-in contact role. It cannot be invoiced.
INSERT INTO public.pro_crm_roles (slug, name, can_invoice, is_system, sort_order)
SELECT 'project_manager', 'Project manager', false, true, 6
WHERE NOT EXISTS (
  SELECT 1 FROM public.pro_crm_roles existing
  WHERE existing.owner_id IS NULL AND existing.slug = 'project_manager'
);

-- People assigned to one job. The contact keeps their own roles.
CREATE TABLE IF NOT EXISTS public.pro_crm_project_members (
  project_id UUID NOT NULL REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.pro_crm_roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_project_members_contact
  ON public.pro_crm_project_members (contact_id);

ALTER TABLE public.pro_jobsite_photos
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paired_photo_id UUID REFERENCES public.pro_jobsite_photos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pro_jobsite_photos_one_cover
  ON public.pro_jobsite_photos (project_id)
  WHERE is_cover = true AND trashed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pro_jobsite_photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.pro_jobsite_photos(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_jobsite_photo_comments_body_len CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_pro_jobsite_photo_comments_photo
  ON public.pro_jobsite_photo_comments (photo_id, created_at);

ALTER TABLE public.pro_crm_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_jobsite_photo_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_crm_project_members_owner" ON public.pro_crm_project_members;
CREATE POLICY "pro_crm_project_members_owner" ON public.pro_crm_project_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_projects project
      WHERE project.id = project_id AND project.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_projects project
      WHERE project.id = project_id AND project.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pro_jobsite_photo_comments_owner" ON public.pro_jobsite_photo_comments;
CREATE POLICY "pro_jobsite_photo_comments_owner" ON public.pro_jobsite_photo_comments
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pro_jobsite_photos photo
      WHERE photo.id = photo_id AND photo.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pro_jobsite_photos photo
      WHERE photo.id = photo_id AND photo.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_jobsite_photo_comments TO authenticated;
GRANT ALL ON public.pro_crm_project_members TO service_role;
GRANT ALL ON public.pro_jobsite_photo_comments TO service_role;
