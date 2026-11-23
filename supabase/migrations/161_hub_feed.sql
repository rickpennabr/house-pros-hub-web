-- Hub Feed: a public timeline of real activity on the Hub (Venmo style).
-- "Aldana Studios sent an estimate to James B.", "James B. approved the estimate",
-- "Day 1 photos", "Juan G. sent a FixCam request", "Mary A. joined the Hub".
--
-- Privacy rules baked in here:
--   * Customers show as first name + last initial. Businesses show their full name.
--   * City only. Never a street, gate code, amount or price.
--   * A CRM contact without a Hub account never agreed to Hub terms: no name, the feed says
--     "a customer in {city}".
--   * Job photos land as 'pending' and go public only after an admin approves them.
--   * Anyone in an item can hide it (see /api/feed/[id]).
--
-- Rows are written only by the SECURITY DEFINER functions below (via triggers) and by the
-- service-role API. Only the server reads them; /api/feed serves the public view.

CREATE TABLE IF NOT EXISTS public.hub_feed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN (
    'member_joined',
    'pro_joined',
    'estimate_requested',
    'fix_requested',
    'estimate_sent',
    'estimate_approved',
    'project_scheduled',
    'project_photos',
    'feedback_left'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_name TEXT,
  actor_avatar TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  target_name TEXT,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  city TEXT,
  service_label TEXT,
  event_date DATE,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  photo_drive_file_ids UUID[] NOT NULL DEFAULT '{}',
  -- Stable per-day key (YYYYMMDD) for photo events, 0 for everything else.
  photo_day INTEGER NOT NULL DEFAULT 0,
  -- 1 for the first day with photos, 2 for the next, and so on.
  photo_day_no INTEGER,
  photo_single_day BOOLEAN NOT NULL DEFAULT false,
  excerpt TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'pending', 'hidden')),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hub_feed_events_source_unique UNIQUE (kind, source_table, source_id, photo_day),
  CONSTRAINT hub_feed_events_excerpt_len CHECK (excerpt IS NULL OR char_length(excerpt) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_hub_feed_events_visible_time
  ON public.hub_feed_events (visibility, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_hub_feed_events_city
  ON public.hub_feed_events (lower(city));
CREATE INDEX IF NOT EXISTS idx_hub_feed_events_project
  ON public.hub_feed_events (project_id) WHERE project_id IS NOT NULL;

COMMENT ON TABLE public.hub_feed_events IS
  'Public Hub Feed timeline. Written by triggers; customers are first name + last initial, city only, no amounts.';

-- RLS on with no policies: rows hold user ids, so only the server (service role) reads them and
-- /api/feed returns the public, trimmed view.
ALTER TABLE public.hub_feed_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Name helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hub_feed_short_name(p_first TEXT, p_last TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(concat_ws(' ',
    NULLIF(btrim(p_first), ''),
    CASE WHEN NULLIF(btrim(p_last), '') IS NOT NULL THEN upper(left(btrim(p_last), 1)) || '.' END
  )), '');
$$;

-- "John Garcia Lopez" -> "John L."; a single word stays as is.
CREATE OR REPLACE FUNCTION public.hub_feed_short_full_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(p_name), '') IS NULL THEN NULL
    WHEN position(' ' IN btrim(p_name)) = 0 THEN btrim(p_name)
    ELSE public.hub_feed_short_name(
      split_part(btrim(p_name), ' ', 1),
      regexp_replace(btrim(p_name), '^.*\s', '')
    )
  END;
$$;

-- City of a user's personal address (profiles lost their address columns in 081).
CREATE OR REPLACE FUNCTION public.hub_feed_personal_city(p_user UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(btrim(a.city), '')
  FROM public.addresses a
  WHERE a.user_id = p_user AND a.address_type = 'personal'
  ORDER BY a.updated_at DESC NULLS LAST
  LIMIT 1;
$$;

-- The pro behind a CRM owner: their first active business, else their profile.
CREATE OR REPLACE FUNCTION public.hub_feed_pro(
  p_owner UUID,
  OUT business_id UUID,
  OUT name TEXT,
  OUT avatar TEXT,
  OUT city TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT b.id, b.business_name, b.business_logo, a.city
    INTO business_id, name, avatar, city
  FROM public.businesses b
  LEFT JOIN public.addresses a ON a.id = b.business_address_id
  WHERE b.owner_id = p_owner AND COALESCE(b.is_active, true)
  ORDER BY b.created_at
  LIMIT 1;

  IF name IS NULL THEN
    SELECT public.hub_feed_short_name(p.first_name, p.last_name), p.user_picture
      INTO name, avatar
    FROM public.profiles p
    WHERE p.id = p_owner;
    city := public.hub_feed_personal_city(p_owner);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Recorders (one per source). Triggers and the backfill both call these.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hub_feed_record_profile(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profiles%ROWTYPE;
  v_name TEXT;
BEGIN
  SELECT * INTO r FROM public.profiles WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_name := public.hub_feed_short_name(r.first_name, r.last_name);
  IF v_name IS NULL THEN RETURN; END IF;

  INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_avatar, actor_user_id, city, source_table, source_id)
  VALUES ('member_joined', r.created_at, v_name, r.user_picture, r.id, public.hub_feed_personal_city(r.id), 'profiles', r.id)
  ON CONFLICT (kind, source_table, source_id, photo_day) DO UPDATE
    SET actor_name = EXCLUDED.actor_name,
        actor_avatar = EXCLUDED.actor_avatar,
        city = EXCLUDED.city;
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_feed_record_business(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.businesses%ROWTYPE;
  v_city TEXT;
BEGIN
  SELECT * INTO r FROM public.businesses WHERE id = p_id;
  IF NOT FOUND OR NOT COALESCE(r.is_active, true) THEN RETURN; END IF;
  SELECT a.city INTO v_city FROM public.addresses a WHERE a.id = r.business_address_id;

  INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_avatar, actor_user_id, business_id, city, source_table, source_id)
  VALUES ('pro_joined', r.created_at, r.business_name, r.business_logo, r.owner_id, r.id, NULLIF(btrim(v_city), ''), 'businesses', r.id)
  ON CONFLICT (kind, source_table, source_id, photo_day) DO UPDATE
    SET actor_name = EXCLUDED.actor_name,
        actor_avatar = EXCLUDED.actor_avatar,
        city = EXCLUDED.city;
END;
$$;

-- Hub estimate form and FixCam requests. City only: no street, no description, no budget.
CREATE OR REPLACE FUNCTION public.hub_feed_record_hub_estimate(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.estimates%ROWTYPE;
  v_kind TEXT;
BEGIN
  SELECT * INTO r FROM public.estimates WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_kind := CASE WHEN r.source = 'quick_repair' THEN 'fix_requested' ELSE 'estimate_requested' END;

  INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_user_id, city, source_table, source_id)
  VALUES (v_kind, r.created_at, public.hub_feed_short_name(r.first_name, r.last_name), r.user_id,
          NULLIF(btrim(r.city), ''), 'estimates', r.id)
  ON CONFLICT (kind, source_table, source_id, photo_day) DO NOTHING;
END;
$$;

-- CRM estimate sent (pro -> customer) or approved (customer -> pro). No amounts.
CREATE OR REPLACE FUNCTION public.hub_feed_record_crm_estimate(p_id UUID, p_kind TEXT, p_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.pro_crm_estimates%ROWTYPE;
  c public.pro_crm_customers%ROWTYPE;
  pro RECORD;
  v_customer TEXT;
BEGIN
  IF p_kind NOT IN ('estimate_sent', 'estimate_approved') THEN RETURN; END IF;
  SELECT * INTO e FROM public.pro_crm_estimates WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO c FROM public.pro_crm_customers WHERE id = e.customer_id;
  SELECT * INTO pro FROM public.hub_feed_pro(e.owner_id);
  -- Only Hub account holders are named.
  v_customer := CASE WHEN c.portal_user_id IS NOT NULL THEN public.hub_feed_short_name(c.first_name, c.last_name) END;

  IF p_kind = 'estimate_sent' THEN
    INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_avatar, actor_user_id, business_id,
      target_name, target_user_id, city, service_label, source_table, source_id)
    VALUES ('estimate_sent', COALESCE(p_at, now()), pro.name, pro.avatar, e.owner_id, pro.business_id,
      v_customer, c.portal_user_id, COALESCE(NULLIF(btrim(c.city), ''), pro.city), NULLIF(btrim(e.job_area), ''),
      'pro_crm_estimates', e.id)
    ON CONFLICT (kind, source_table, source_id, photo_day) DO NOTHING;
  ELSE
    INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_user_id, business_id,
      target_name, target_user_id, actor_avatar, city, service_label, source_table, source_id)
    VALUES ('estimate_approved', COALESCE(p_at, now()), v_customer, c.portal_user_id, pro.business_id,
      pro.name, e.owner_id, pro.avatar, COALESCE(NULLIF(btrim(c.city), ''), pro.city), NULLIF(btrim(e.job_area), ''),
      'pro_crm_estimates', e.id)
    ON CONFLICT (kind, source_table, source_id, photo_day) DO NOTHING;
  END IF;
END;
$$;

-- Project start date set. The project name can hold a customer name or street, so the label
-- comes from the linked estimate's job area only.
CREATE OR REPLACE FUNCTION public.hub_feed_record_project_start(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.pro_crm_projects%ROWTYPE;
  c public.pro_crm_customers%ROWTYPE;
  pro RECORD;
  v_area TEXT;
BEGIN
  SELECT * INTO p FROM public.pro_crm_projects WHERE id = p_id;
  IF NOT FOUND OR p.start_date IS NULL OR p.status = 'cancelled' THEN RETURN; END IF;
  SELECT * INTO c FROM public.pro_crm_customers WHERE id = p.customer_id;
  SELECT * INTO pro FROM public.hub_feed_pro(p.owner_id);
  IF p.estimate_id IS NOT NULL THEN
    SELECT NULLIF(btrim(job_area), '') INTO v_area FROM public.pro_crm_estimates WHERE id = p.estimate_id;
  END IF;

  INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_avatar, actor_user_id, business_id,
    target_name, target_user_id, city, service_label, event_date, project_id, source_table, source_id)
  VALUES ('project_scheduled', now(), pro.name, pro.avatar, p.owner_id, pro.business_id,
    CASE WHEN c.portal_user_id IS NOT NULL THEN public.hub_feed_short_name(c.first_name, c.last_name) END,
    c.portal_user_id, COALESCE(NULLIF(btrim(c.city), ''), pro.city), v_area, p.start_date, p.id,
    'pro_crm_projects', p.id)
  ON CONFLICT (kind, source_table, source_id, photo_day) DO UPDATE
    SET event_date = EXCLUDED.event_date,
        occurred_at = EXCLUDED.occurred_at;
END;
$$;

-- Job photos: one event per project per day (Las Vegas time). Rebuilt from the photo rows so
-- inserts and deletes both stay in sync. New days start 'pending' (admin approval).
CREATE OR REPLACE FUNCTION public.hub_feed_sync_project_photos(p_project UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.pro_crm_projects%ROWTYPE;
  c public.pro_crm_customers%ROWTYPE;
  pro RECORD;
  v_area TEXT;
  v_single BOOLEAN;
BEGIN
  SELECT * INTO p FROM public.pro_crm_projects WHERE id = p_project;
  IF NOT FOUND THEN
    DELETE FROM public.hub_feed_events WHERE kind = 'project_photos' AND project_id = p_project;
    RETURN;
  END IF;
  SELECT * INTO c FROM public.pro_crm_customers WHERE id = p.customer_id;
  SELECT * INTO pro FROM public.hub_feed_pro(p.owner_id);
  IF p.estimate_id IS NOT NULL THEN
    SELECT NULLIF(btrim(job_area), '') INTO v_area FROM public.pro_crm_estimates WHERE id = p.estimate_id;
  END IF;
  v_single := p.start_date IS NOT NULL AND p.end_date IS NOT NULL AND p.start_date = p.end_date;

  WITH days AS (
    SELECT (ph.taken_at AT TIME ZONE 'America/Los_Angeles')::date AS day,
           array_agg(ph.drive_file_id ORDER BY ph.taken_at) AS files,
           max(ph.taken_at) AS last_at
    FROM public.pro_jobsite_photos ph
    WHERE ph.project_id = p.id
    GROUP BY 1
  ),
  numbered AS (
    SELECT d.*, (d.day - min(d.day) OVER ()) + 1 AS day_no FROM days d
  )
  INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_avatar, actor_user_id, business_id,
    target_name, target_user_id, city, service_label, event_date, project_id, photo_drive_file_ids,
    photo_day, photo_day_no, photo_single_day, visibility, source_table, source_id)
  SELECT 'project_photos', n.last_at, pro.name, pro.avatar, p.owner_id, pro.business_id,
    CASE WHEN c.portal_user_id IS NOT NULL THEN public.hub_feed_short_name(c.first_name, c.last_name) END,
    c.portal_user_id, COALESCE(NULLIF(btrim(c.city), ''), pro.city), v_area, n.day, p.id, n.files,
    to_char(n.day, 'YYYYMMDD')::int, n.day_no, v_single, 'pending', 'pro_crm_projects', p.id
  FROM numbered n
  ON CONFLICT (kind, source_table, source_id, photo_day) DO UPDATE
    SET photo_drive_file_ids = EXCLUDED.photo_drive_file_ids,
        occurred_at = EXCLUDED.occurred_at,
        photo_day_no = EXCLUDED.photo_day_no,
        photo_single_day = EXCLUDED.photo_single_day,
        -- New photos on an approved day go back to review; hidden days stay hidden.
        visibility = CASE
          WHEN hub_feed_events.visibility = 'public'
           AND NOT (EXCLUDED.photo_drive_file_ids <@ hub_feed_events.photo_drive_file_ids)
          THEN 'pending'
          ELSE hub_feed_events.visibility
        END;

  -- Drop days that no longer have photos.
  DELETE FROM public.hub_feed_events ev
  WHERE ev.kind = 'project_photos'
    AND ev.project_id = p.id
    AND NOT EXISTS (
      SELECT 1 FROM public.pro_jobsite_photos ph
      WHERE ph.project_id = p.id
        AND (ph.taken_at AT TIME ZONE 'America/Los_Angeles')::date = ev.event_date
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_feed_record_feedback(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.business_feedback%ROWTYPE;
  b public.businesses%ROWTYPE;
  v_city TEXT;
BEGIN
  SELECT * INTO f FROM public.business_feedback WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = f.business_id;
  SELECT a.city INTO v_city FROM public.addresses a WHERE a.id = b.business_address_id;

  INSERT INTO public.hub_feed_events (kind, occurred_at, actor_name, actor_user_id, business_id,
    target_name, target_user_id, actor_avatar, city, excerpt, source_table, source_id)
  VALUES ('feedback_left', f.created_at, public.hub_feed_short_full_name(f.author_name), f.author_user_id, b.id,
    b.business_name, b.owner_id, b.business_logo, NULLIF(btrim(v_city), ''), left(btrim(f.body), 280),
    'business_feedback', f.id)
  ON CONFLICT (kind, source_table, source_id, photo_day) DO NOTHING;
END;
$$;

-- These run only from triggers, the backfill and the service role.
REVOKE ALL ON FUNCTION public.hub_feed_personal_city(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_pro(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_record_profile(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_record_business(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_record_hub_estimate(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_record_crm_estimate(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_record_project_start(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_sync_project_photos(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_feed_record_feedback(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers. A feed failure must never block the real write, so each one swallows errors.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hub_feed_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'profiles' THEN
      PERFORM public.hub_feed_record_profile(NEW.id);
    ELSIF TG_TABLE_NAME = 'addresses' THEN
      -- The address usually arrives after the profile or business row: refresh the city.
      IF NEW.address_type = 'personal' THEN
        PERFORM public.hub_feed_record_profile(NEW.user_id);
      ELSE
        PERFORM public.hub_feed_record_business(b.id)
        FROM public.businesses b WHERE b.business_address_id = NEW.id;
      END IF;
    ELSIF TG_TABLE_NAME = 'businesses' THEN
      PERFORM public.hub_feed_record_business(NEW.id);
    ELSIF TG_TABLE_NAME = 'estimates' THEN
      PERFORM public.hub_feed_record_hub_estimate(NEW.id);
    ELSIF TG_TABLE_NAME = 'pro_crm_estimates' THEN
      IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
        PERFORM public.hub_feed_record_crm_estimate(NEW.id, 'estimate_sent', now());
      ELSIF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
        PERFORM public.hub_feed_record_crm_estimate(NEW.id, 'estimate_approved', now());
      END IF;
    ELSIF TG_TABLE_NAME = 'pro_crm_projects' THEN
      IF NEW.start_date IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.start_date IS DISTINCT FROM NEW.start_date) THEN
        PERFORM public.hub_feed_record_project_start(NEW.id);
      END IF;
    ELSIF TG_TABLE_NAME = 'business_feedback' THEN
      PERFORM public.hub_feed_record_feedback(NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_feed_trg % failed: %', TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_feed_photos_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.hub_feed_sync_project_photos(COALESCE(NEW.project_id, OLD.project_id));
    IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.hub_feed_sync_project_photos(OLD.project_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_feed_photos_trg failed: %', SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS hub_feed_profiles ON public.profiles;
CREATE TRIGGER hub_feed_profiles
  AFTER INSERT OR UPDATE OF first_name, last_name, user_picture ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_addresses ON public.addresses;
CREATE TRIGGER hub_feed_addresses
  AFTER INSERT OR UPDATE OF city ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_businesses ON public.businesses;
CREATE TRIGGER hub_feed_businesses
  AFTER INSERT OR UPDATE OF business_name, business_logo, is_active, business_address_id ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_estimates ON public.estimates;
CREATE TRIGGER hub_feed_estimates
  AFTER INSERT ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_crm_estimates ON public.pro_crm_estimates;
CREATE TRIGGER hub_feed_crm_estimates
  AFTER INSERT OR UPDATE OF status ON public.pro_crm_estimates
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_crm_projects ON public.pro_crm_projects;
CREATE TRIGGER hub_feed_crm_projects
  AFTER INSERT OR UPDATE OF start_date ON public.pro_crm_projects
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_business_feedback ON public.business_feedback;
CREATE TRIGGER hub_feed_business_feedback
  AFTER INSERT ON public.business_feedback
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_trg();

DROP TRIGGER IF EXISTS hub_feed_jobsite_photos ON public.pro_jobsite_photos;
CREATE TRIGGER hub_feed_jobsite_photos
  AFTER INSERT OR UPDATE OF project_id, taken_at OR DELETE ON public.pro_jobsite_photos
  FOR EACH ROW EXECUTE FUNCTION public.hub_feed_photos_trg();

-- ---------------------------------------------------------------------------
-- Backfill the last 90 days so the feed is not empty on day one.
-- ---------------------------------------------------------------------------

SELECT public.hub_feed_record_profile(id) FROM public.profiles WHERE created_at > now() - interval '90 days';
SELECT public.hub_feed_record_business(id) FROM public.businesses WHERE created_at > now() - interval '90 days';
SELECT public.hub_feed_record_hub_estimate(id) FROM public.estimates WHERE created_at > now() - interval '90 days';
SELECT public.hub_feed_record_crm_estimate(id, 'estimate_sent', created_at)
  FROM public.pro_crm_estimates
  WHERE status IN ('sent', 'accepted', 'declined') AND created_at > now() - interval '90 days';
SELECT public.hub_feed_record_crm_estimate(id, 'estimate_approved', COALESCE(signed_at, updated_at))
  FROM public.pro_crm_estimates
  WHERE status = 'accepted' AND updated_at > now() - interval '90 days';
SELECT public.hub_feed_record_project_start(id)
  FROM public.pro_crm_projects
  WHERE start_date IS NOT NULL AND updated_at > now() - interval '90 days';
UPDATE public.hub_feed_events ev
  SET occurred_at = p.updated_at
  FROM public.pro_crm_projects p
  WHERE ev.kind = 'project_scheduled' AND ev.project_id = p.id;
SELECT public.hub_feed_sync_project_photos(project_id)
  FROM (SELECT DISTINCT project_id FROM public.pro_jobsite_photos WHERE taken_at > now() - interval '90 days') s;
SELECT public.hub_feed_record_feedback(id) FROM public.business_feedback WHERE created_at > now() - interval '90 days';
