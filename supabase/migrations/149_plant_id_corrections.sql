-- Plant ID corrections: when the AI names a plant wrong, an admin records the right name, how to
-- tell it apart, and the photo. Every later identification reads these: the notes go in the
-- instructions, and when a new photo looks like a corrected case, the corrected photos are sent
-- along as labeled reference examples. This is how the team "trains" the plant identifier.

CREATE TABLE IF NOT EXISTS public.ai_plant_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  wrong_common_name TEXT,
  wrong_scientific_name TEXT,
  correct_common_name TEXT NOT NULL,
  correct_scientific_name TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  source_message_id UUID REFERENCES public.probot_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_plant_corrections_name_len CHECK (char_length(correct_common_name) BETWEEN 1 AND 120),
  CONSTRAINT ai_plant_corrections_notes_len CHECK (notes IS NULL OR char_length(notes) <= 600)
);

CREATE INDEX IF NOT EXISTS idx_ai_plant_corrections_active
  ON public.ai_plant_corrections (created_at DESC)
  WHERE active;

DROP TRIGGER IF EXISTS update_ai_plant_corrections_updated_at ON public.ai_plant_corrections;
CREATE TRIGGER update_ai_plant_corrections_updated_at
  BEFORE UPDATE ON public.ai_plant_corrections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Admin-only data, read and written through the service role (admin API routes).
ALTER TABLE public.ai_plant_corrections ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_plant_corrections TO service_role;

COMMENT ON TABLE public.ai_plant_corrections IS
  'Admin corrections to AI plant identifications. Fed back into every identification as notes and reference photos.';
