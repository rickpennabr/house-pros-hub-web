-- Extra "How did you hear about us?" choices added by an admin.
-- Built-in choices stay in the app. These rows are appended before Other.
CREATE TABLE IF NOT EXISTS referral_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  asks_for_name BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_options_label_lower_idx
  ON referral_options (lower(label));

CREATE INDEX IF NOT EXISTS referral_options_sort_idx
  ON referral_options (sort_order);

ALTER TABLE referral_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view referral options"
  ON referral_options FOR SELECT
  USING (true);
