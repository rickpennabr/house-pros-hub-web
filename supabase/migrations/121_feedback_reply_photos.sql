-- A pro reply can include photos. Customers and admins delete reviews; the pro cannot.

ALTER TABLE public.business_feedback
  ADD COLUMN IF NOT EXISTS pro_response_image_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.business_feedback
  DROP CONSTRAINT IF EXISTS business_feedback_response_images_max;

ALTER TABLE public.business_feedback
  ADD CONSTRAINT business_feedback_response_images_max
  CHECK (cardinality(pro_response_image_urls) <= 5);

COMMENT ON COLUMN public.business_feedback.pro_response_image_urls IS
  'Photos attached to the pro reply. The pro cannot delete the customer review.';
