-- A task on one job photo. The assignee is a contact on the pro's CRM.

CREATE TABLE IF NOT EXISTS public.pro_jobsite_photo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.pro_jobsite_photos(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  assignee_contact_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_jobsite_photo_tasks_title_len CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_pro_jobsite_photo_tasks_photo
  ON public.pro_jobsite_photo_tasks (photo_id, created_at);

ALTER TABLE public.pro_jobsite_photo_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_jobsite_photo_tasks_owner" ON public.pro_jobsite_photo_tasks;
CREATE POLICY "pro_jobsite_photo_tasks_owner" ON public.pro_jobsite_photo_tasks
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_jobsite_photo_tasks TO authenticated;
GRANT ALL ON public.pro_jobsite_photo_tasks TO service_role;
