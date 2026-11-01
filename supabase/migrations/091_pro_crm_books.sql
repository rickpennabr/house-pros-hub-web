-- ProsCRM books: payment ledger, partial/cancelled invoices, activity, recurring invoices, reminders.
-- Keeps payment_applied_cents as the cached sum of payments that are not voided.

ALTER TABLE public.pro_crm_invoices DROP CONSTRAINT IF EXISTS pro_crm_invoices_status_check;
ALTER TABLE public.pro_crm_invoices
  ADD CONSTRAINT pro_crm_invoices_status_check
  CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'));

ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurring_invoice_id UUID;

CREATE TABLE IF NOT EXISTS public.pro_crm_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.pro_crm_invoices(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'other' CHECK (method IN ('cash', 'check', 'card', 'transfer', 'other')),
  reference TEXT,
  note TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_invoice_payments_invoice
  ON public.pro_crm_invoice_payments (invoice_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoice_payments_owner
  ON public.pro_crm_invoice_payments (owner_id);

ALTER TABLE public.pro_crm_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own invoice payments" ON public.pro_crm_invoice_payments;
CREATE POLICY "Contractors manage own invoice payments"
  ON public.pro_crm_invoice_payments
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.pro_crm_document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.pro_crm_invoices(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'sent',
    'payment_recorded',
    'payment_voided',
    'cancelled',
    'reminded',
    'recurred'
  )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_document_events_invoice
  ON public.pro_crm_document_events (invoice_id, created_at DESC);

ALTER TABLE public.pro_crm_document_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own document events" ON public.pro_crm_document_events;
CREATE POLICY "Contractors manage own document events"
  ON public.pro_crm_document_events
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.pro_crm_recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
  next_run_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  line_items JSONB,
  payment_terms TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_recurring_invoices_owner
  ON public.pro_crm_recurring_invoices (owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_recurring_invoices_due
  ON public.pro_crm_recurring_invoices (next_run_date)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS update_pro_crm_recurring_invoices_updated_at ON public.pro_crm_recurring_invoices;
CREATE TRIGGER update_pro_crm_recurring_invoices_updated_at
  BEFORE UPDATE ON public.pro_crm_recurring_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_recurring_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own recurring invoices" ON public.pro_crm_recurring_invoices;
CREATE POLICY "Contractors manage own recurring invoices"
  ON public.pro_crm_recurring_invoices
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.pro_crm_invoices
  DROP CONSTRAINT IF EXISTS pro_crm_invoices_recurring_invoice_id_fkey;
ALTER TABLE public.pro_crm_invoices
  ADD CONSTRAINT pro_crm_invoices_recurring_invoice_id_fkey
  FOREIGN KEY (recurring_invoice_id) REFERENCES public.pro_crm_recurring_invoices(id) ON DELETE SET NULL;

COMMENT ON TABLE public.pro_crm_invoice_payments IS 'ProsCRM payment ledger. Voided rows stay for history and are excluded from the balance.';
COMMENT ON TABLE public.pro_crm_document_events IS 'ProsCRM invoice activity: sent, paid, voided, cancelled, reminded, recurred.';
COMMENT ON TABLE public.pro_crm_recurring_invoices IS 'ProsCRM schedule that clones an invoice on weekly, biweekly, monthly, or yearly dates.';
