-- Dynamic QR codes. The printed mark points at /q/{code}.
-- A scan is counted, then the phone is sent to the current destination.

CREATE TABLE IF NOT EXISTS public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('site', 'card', 'extra')),
  label TEXT NOT NULL,
  destination TEXT NOT NULL,
  scan_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qr_codes_label_len CHECK (char_length(label) BETWEEN 1 AND 80),
  CONSTRAINT qr_codes_destination_len CHECK (char_length(destination) BETWEEN 8 AND 500),
  CONSTRAINT qr_codes_code_len CHECK (char_length(code) BETWEEN 6 AND 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_one_site
  ON public.qr_codes (kind)
  WHERE kind = 'site';

CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_one_card_per_owner
  ON public.qr_codes (owner_id)
  WHERE kind = 'card' AND owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device TEXT NOT NULL CHECK (device IN ('phone', 'tablet', 'computer')),
  visitor_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_code_time
  ON public.qr_scans (qr_code_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scans_time
  ON public.qr_scans (scanned_at DESC);

DROP TRIGGER IF EXISTS update_qr_codes_updated_at ON public.qr_codes;
CREATE TRIGGER update_qr_codes_updated_at
  BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their QR codes" ON public.qr_codes;
CREATE POLICY "Owners read their QR codes"
  ON public.qr_codes
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners read their QR scans" ON public.qr_scans;
CREATE POLICY "Owners read their QR scans"
  ON public.qr_scans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qr_codes
      WHERE qr_codes.id = qr_scans.qr_code_id
        AND qr_codes.owner_id = auth.uid()
    )
  );

GRANT SELECT ON public.qr_codes TO authenticated;
GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
GRANT ALL ON public.qr_scans TO service_role;

-- Counts a scan and returns the page the phone should open.
CREATE OR REPLACE FUNCTION public.record_qr_scan(
  p_code text,
  p_device text,
  p_visitor text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid uuid;
  dest text;
BEGIN
  SELECT id, destination INTO qid, dest
  FROM public.qr_codes
  WHERE code = p_code;

  IF qid IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.qr_scans (qr_code_id, device, visitor_hash)
  VALUES (qid, p_device, left(coalesce(p_visitor, 'unknown'), 64));

  UPDATE public.qr_codes
  SET scan_count = scan_count + 1,
      last_scanned_at = now()
  WHERE id = qid;

  RETURN dest;
END;
$$;

REVOKE ALL ON FUNCTION public.record_qr_scan(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_qr_scan(text, text, text) TO service_role;
