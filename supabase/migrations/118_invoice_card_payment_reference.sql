-- One Stripe Checkout session can be recorded only once on an invoice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_invoice_payments_stripe_reference
  ON public.pro_crm_invoice_payments (invoice_id, reference)
  WHERE reference IS NOT NULL AND voided_at IS NULL;
