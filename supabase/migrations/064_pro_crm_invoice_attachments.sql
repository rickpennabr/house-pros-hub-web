-- ProsCRM: invoice attachments (PDF, images). Max 20MB per file, path in storage.
CREATE TABLE IF NOT EXISTS public.pro_crm_invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.pro_crm_invoices(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_invoice_attachments_invoice_id
  ON public.pro_crm_invoice_attachments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoice_attachments_owner_id
  ON public.pro_crm_invoice_attachments(owner_id);

ALTER TABLE public.pro_crm_invoice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own invoice attachments"
  ON public.pro_crm_invoice_attachments
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_invoice_attachments IS 'ProsCRM: files attached to invoices (PDF, images). Max 20MB per file.';

-- Storage bucket for invoice attachments (path: {owner_id}/{invoice_id}/{filename}). Max 20MB enforced in API.
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: only invoice owner can upload/read/delete their files (path prefix owner_id)
CREATE POLICY "Contractors can upload own invoice attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Contractors can view own invoice attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Contractors can delete own invoice attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
