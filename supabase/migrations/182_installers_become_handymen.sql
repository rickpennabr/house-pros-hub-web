-- No installers for now: every installer becomes a handyman (same person page, same ProResume/ProJobs access).
-- The installer tables stay (empty of new use) so nothing breaks; the app no longer offers the role.

-- 1. Installer pages -> handyman pages (same slug when it is free, otherwise slug-h).
INSERT INTO public.handyman_profiles (user_id, slug, display_name, photo_url, phone, email, bio, trades, service_area, created_at, updated_at)
SELECT i.user_id,
       CASE WHEN EXISTS (SELECT 1 FROM public.handyman_profiles h WHERE h.slug = i.slug)
            THEN left(i.slug, 76) || '-h' ELSE i.slug END,
       i.display_name, i.photo_url, i.phone, i.email, i.bio, i.trades, i.service_area, i.created_at, NOW()
FROM public.installer_profiles i
WHERE NOT EXISTS (SELECT 1 FROM public.handyman_profiles h WHERE h.user_id = i.user_id);

-- 2. Installer role -> handyman role.
INSERT INTO public.user_roles (user_id, role, is_active, activated_at)
SELECT DISTINCT ON (r.user_id) r.user_id, 'handyman', COALESCE(r.is_active, true), COALESCE(r.activated_at, NOW())
FROM public.user_roles r
WHERE r.role = 'installer'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles h WHERE h.user_id = r.user_id AND h.role = 'handyman');
DELETE FROM public.user_roles WHERE role = 'installer';

-- 3. Unused installer invitation codes sign people up as handymen.
UPDATE public.invitation_codes SET role = 'handyman' WHERE role = 'installer';
