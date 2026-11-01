-- Create storage bucket for business gallery images (max 10 per business).
-- RLS policies are in 022_add_business_images.sql; this creates the bucket so uploads work.
-- If you get "Bucket not found" on upload: run this migration (e.g. supabase db push)
-- or run the INSERT below manually in Supabase Dashboard > SQL Editor.
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-images', 'business-images', true)
ON CONFLICT (id) DO NOTHING;
