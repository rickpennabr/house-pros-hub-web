-- Fix lint: function_search_path_mutable (0011)
-- Set explicit search_path on trigger function to prevent search_path injection.
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

CREATE OR REPLACE FUNCTION public.update_probot_conversation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.probot_conversations
  SET updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
