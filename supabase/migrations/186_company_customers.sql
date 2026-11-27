-- Company customers and billing.
-- A company contact (an LLC, a property manager) needs no person's name: first and last name
-- may be empty strings (the columns stay NOT NULL; the app stores '' when there is no contact person).
-- billing_email: accounts payable. Invoices, reminders and statements go there when it is set.
-- po_number: the customer's purchase order number, printed on the invoice.

ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS billing_email TEXT
    CHECK (billing_email IS NULL OR char_length(billing_email) <= 254);

ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS po_number TEXT
    CHECK (po_number IS NULL OR char_length(po_number) <= 40);

COMMENT ON COLUMN public.pro_crm_customers.billing_email IS 'Accounts payable email. Invoices go here when set (main email is copied).';
COMMENT ON COLUMN public.pro_crm_invoices.po_number IS 'Customer purchase order number shown on the invoice.';
