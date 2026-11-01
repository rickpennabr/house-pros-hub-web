-- Align stored due_date with invoice_date for invoices due on receipt (null/empty terms
-- or explicit receipt wording). Previously some rows had estimate validity dates copied.
UPDATE public.pro_crm_invoices
SET due_date = invoice_date
WHERE due_date IS DISTINCT FROM invoice_date
  AND (
    payment_terms IS NULL
    OR trim(payment_terms) = ''
    OR payment_terms ILIKE '%due on receipt%'
    OR payment_terms ILIKE '%upon receipt%'
    OR payment_terms ILIKE '%on receipt%'
  );
