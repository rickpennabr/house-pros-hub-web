-- One contact record, many roles. Same shape as SAP Business Partner, Oracle parties,
-- and Xero contacts: the person or company is stored once, and Customer / Supplier /
-- Installer / Subcontractor are roles on that record. A pro can add more roles.
-- pro_crm_customers stays the contact row so estimates, invoices, and projects
-- keep their existing foreign keys. The public suppliers directory is unrelated.

CREATE TABLE IF NOT EXISTS public.pro_crm_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  can_invoice BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_roles_owner_system_chk CHECK (
    (is_system = true AND owner_id IS NULL)
    OR (is_system = false AND owner_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_roles_system_slug
  ON public.pro_crm_roles (slug)
  WHERE owner_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_roles_owner_slug
  ON public.pro_crm_roles (owner_id, slug)
  WHERE owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pro_crm_contact_roles (
  contact_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.pro_crm_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_contact_roles_role
  ON public.pro_crm_contact_roles (role_id);

INSERT INTO public.pro_crm_roles (slug, name, can_invoice, is_system, sort_order)
SELECT slug, name, can_invoice, true, sort_order
FROM (
  VALUES
    ('customer', 'Customer', true, 1),
    ('supplier', 'Supplier', false, 2),
    ('installer', 'Installer', false, 3),
    ('subcontractor', 'Subcontractor', false, 4)
) AS seed(slug, name, can_invoice, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pro_crm_roles existing
  WHERE existing.owner_id IS NULL AND existing.slug = seed.slug
);

-- Every existing contact is a customer until the pro adds more roles.
INSERT INTO public.pro_crm_contact_roles (contact_id, role_id)
SELECT customer.id, role.id
FROM public.pro_crm_customers customer
JOIN public.pro_crm_roles role
  ON role.owner_id IS NULL AND role.slug = 'customer'
ON CONFLICT DO NOTHING;

ALTER TABLE public.pro_crm_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_crm_contact_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read system and own contact roles" ON public.pro_crm_roles;
CREATE POLICY "Read system and own contact roles"
  ON public.pro_crm_roles FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Create own contact roles" ON public.pro_crm_roles;
CREATE POLICY "Create own contact roles"
  ON public.pro_crm_roles FOR INSERT
  WITH CHECK (owner_id = auth.uid() AND is_system = false);

DROP POLICY IF EXISTS "Update own contact roles" ON public.pro_crm_roles;
CREATE POLICY "Update own contact roles"
  ON public.pro_crm_roles FOR UPDATE
  USING (owner_id = auth.uid() AND is_system = false)
  WITH CHECK (owner_id = auth.uid() AND is_system = false);

DROP POLICY IF EXISTS "Delete own contact roles" ON public.pro_crm_roles;
CREATE POLICY "Delete own contact roles"
  ON public.pro_crm_roles FOR DELETE
  USING (owner_id = auth.uid() AND is_system = false);

DROP POLICY IF EXISTS "Manage roles on own contacts" ON public.pro_crm_contact_roles;
CREATE POLICY "Manage roles on own contacts"
  ON public.pro_crm_contact_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_customers contact
      WHERE contact.id = contact_id AND contact.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_customers contact
      WHERE contact.id = contact_id AND contact.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.pro_crm_roles role
      WHERE role.id = role_id
        AND (role.owner_id IS NULL OR role.owner_id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_contact_roles TO authenticated;
GRANT ALL ON public.pro_crm_roles TO service_role;
GRANT ALL ON public.pro_crm_contact_roles TO service_role;

COMMENT ON TABLE public.pro_crm_customers IS
  'ProsCRM contact (party). Roles such as customer and supplier live in pro_crm_contact_roles.';
COMMENT ON TABLE public.pro_crm_roles IS
  'Contact roles. System rows are shared. A contractor can add more. can_invoice allows estimates and invoices.';
COMMENT ON TABLE public.pro_crm_contact_roles IS
  'Roles assigned to one contact. A contact can hold more than one role.';
