-- Employee is a built-in contact role. It cannot be invoiced.

INSERT INTO public.pro_crm_roles (slug, name, can_invoice, is_system, sort_order)
SELECT 'employee', 'Employee', false, true, 5
WHERE NOT EXISTS (
  SELECT 1 FROM public.pro_crm_roles existing
  WHERE existing.owner_id IS NULL AND existing.slug = 'employee'
);
