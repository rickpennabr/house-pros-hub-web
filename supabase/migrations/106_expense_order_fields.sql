-- Purchase-order details for a materials or equipment expense.
-- Vendor is supplier_id. Material is description. Order date is expense_date.

ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS ordered_by TEXT;

COMMENT ON COLUMN public.pro_crm_expenses.po_number IS 'Purchase order number this expense was bought against.';
COMMENT ON COLUMN public.pro_crm_expenses.quantity IS 'How many units were ordered.';
COMMENT ON COLUMN public.pro_crm_expenses.unit IS 'Unit for quantity, such as bag, sq ft, or each.';
COMMENT ON COLUMN public.pro_crm_expenses.requested_by IS 'Person who asked for the material or equipment.';
COMMENT ON COLUMN public.pro_crm_expenses.ordered_by IS 'Person who placed the order with the vendor.';
