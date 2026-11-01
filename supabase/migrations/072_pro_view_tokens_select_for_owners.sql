-- Allow contractors to read view tokens they created (needed for INSERT ... RETURNING / .select() after insert).
-- INSERT policies already scoped to owned estimates/invoices.

CREATE POLICY "Contractors can read estimate view tokens for own estimates"
  ON public.pro_estimate_view_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_estimates e
      WHERE e.id = estimate_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Contractors can read invoice view tokens for own invoices"
  ON public.pro_invoice_view_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_invoices i
      WHERE i.id = invoice_id AND i.owner_id = auth.uid()
    )
  );
