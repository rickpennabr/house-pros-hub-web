-- Installers are subcontractors. Move any contact already marked installer
-- onto the subcontractor role, then drop the separate system role.

INSERT INTO public.pro_crm_contact_roles (contact_id, role_id)
SELECT link.contact_id, subcontractor.id
FROM public.pro_crm_contact_roles link
JOIN public.pro_crm_roles installer
  ON installer.id = link.role_id
 AND installer.owner_id IS NULL
 AND installer.slug = 'installer'
JOIN public.pro_crm_roles subcontractor
  ON subcontractor.owner_id IS NULL
 AND subcontractor.slug = 'subcontractor'
ON CONFLICT DO NOTHING;

DELETE FROM public.pro_crm_contact_roles link
USING public.pro_crm_roles installer
WHERE link.role_id = installer.id
  AND installer.owner_id IS NULL
  AND installer.slug = 'installer';

DELETE FROM public.pro_crm_roles
WHERE owner_id IS NULL
  AND slug = 'installer';
