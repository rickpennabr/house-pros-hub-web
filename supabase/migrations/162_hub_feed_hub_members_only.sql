-- HubFeed shows only people who signed up for the Hub.
--
-- A pro's CRM contact without a Hub account never agreed to Hub terms, so nothing about them
-- reaches the feed: not their name, and not the event either ("sent an estimate to a customer in
-- Las Vegas" is gone too). Guest estimate / FixCam requests and feedback from people without an
-- account stay out as well.
--
-- When a CRM contact later links to a Hub account (portal_user_id set by the email claim), their
-- work with that pro is added to the feed then. If the link is removed, it is taken back out.

-- Which person in a row must be a Hub account, by kind.
--   actor: member_joined, pro_joined, estimate_requested, fix_requested, estimate_approved, feedback_left
--   target (the customer): estimate_sent, project_scheduled, project_photos
CREATE OR REPLACE FUNCTION public.hub_feed_row_is_hub_member(
  p_kind TEXT,
  p_actor UUID,
  p_target UUID
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_kind IN ('estimate_sent', 'project_scheduled', 'project_photos') THEN p_target IS NOT NULL
    ELSE p_actor IS NOT NULL
  END;
$$;

-- Guard on the table: a row that is not tied to a Hub account is never stored.
-- BEFORE INSERT runs before ON CONFLICT, so returning NULL skips inserts and upserts alike.
CREATE OR REPLACE FUNCTION public.hub_feed_members_only_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.hub_feed_row_is_hub_member(NEW.kind, NEW.actor_user_id, NEW.target_user_id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hub_feed_members_only ON public.hub_feed_events;
CREATE TRIGGER hub_feed_members_only
  BEFORE INSERT ON public.hub_feed_events
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_members_only_trg();

-- A deleted account sets its ids to NULL (ON DELETE SET NULL): drop those rows then.
CREATE OR REPLACE FUNCTION public.hub_feed_members_only_after_update_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.hub_feed_row_is_hub_member(NEW.kind, NEW.actor_user_id, NEW.target_user_id) THEN
    DELETE FROM public.hub_feed_events WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS hub_feed_members_only_update ON public.hub_feed_events;
CREATE TRIGGER hub_feed_members_only_update
  AFTER UPDATE OF actor_user_id, target_user_id ON public.hub_feed_events
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_members_only_after_update_trg();

-- Clean out what is already there.
DELETE FROM public.hub_feed_events
WHERE NOT public.hub_feed_row_is_hub_member(kind, actor_user_id, target_user_id);

-- ---------------------------------------------------------------------------
-- A CRM contact links to (or unlinks from) a Hub account.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hub_feed_sync_crm_customer(p_customer UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.pro_crm_customers%ROWTYPE;
  e RECORD;
  p RECORD;
BEGIN
  SELECT * INTO c FROM public.pro_crm_customers WHERE id = p_customer;
  IF NOT FOUND THEN RETURN; END IF;

  IF c.portal_user_id IS NULL THEN
    -- No longer a Hub member: everything about this contact comes out of the feed.
    DELETE FROM public.hub_feed_events
    WHERE (source_table = 'pro_crm_estimates'
           AND source_id IN (SELECT id FROM public.pro_crm_estimates WHERE customer_id = c.id))
       OR project_id IN (SELECT id FROM public.pro_crm_projects WHERE customer_id = c.id);
    RETURN;
  END IF;

  -- Linked: add what is missing. Rows already there (or hidden by someone) are left as they are.

  FOR e IN
    SELECT id, status, created_at, updated_at, signed_at
    FROM public.pro_crm_estimates
    WHERE customer_id = c.id AND status IN ('sent', 'accepted', 'declined')
  LOOP
    PERFORM public.hub_feed_record_crm_estimate(e.id, 'estimate_sent', e.created_at);
    IF e.status = 'accepted' THEN
      PERFORM public.hub_feed_record_crm_estimate(e.id, 'estimate_approved', COALESCE(e.signed_at, e.updated_at));
    END IF;
  END LOOP;

  FOR p IN
    SELECT id, updated_at, start_date
    FROM public.pro_crm_projects
    WHERE customer_id = c.id
  LOOP
    IF p.start_date IS NOT NULL THEN
      PERFORM public.hub_feed_record_project_start(p.id);
      UPDATE public.hub_feed_events
        SET occurred_at = p.updated_at
        WHERE kind = 'project_scheduled' AND project_id = p.id;
    END IF;
    -- Photo days come back as 'pending' (admin approval), or keep their review state.
    PERFORM public.hub_feed_sync_project_photos(p.id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_feed_sync_crm_customer(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_feed_crm_customer_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.hub_feed_sync_crm_customer(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_feed_crm_customer_trg failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hub_feed_crm_customer_link ON public.pro_crm_customers;
CREATE TRIGGER hub_feed_crm_customer_link
  AFTER UPDATE OF portal_user_id ON public.pro_crm_customers
  FOR EACH ROW
  WHEN (OLD.portal_user_id IS DISTINCT FROM NEW.portal_user_id)
  EXECUTE FUNCTION public.hub_feed_crm_customer_trg();
