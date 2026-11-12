'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/crm/invoice-books';

interface BillingInvoice {
  id: string;
  invoice_number: string;
  amount_cents: number;
  status: string;
}

interface Billing {
  contractCents: number;
  billedCents: number;
  remainingCents: number;
  invoices: BillingInvoice[];
}

interface ProgressInvoiceDialogProps {
  estimateId: string | null;
  onClose: () => void;
  onCreated: (invoiceId: string) => void;
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

export function ProgressInvoiceDialog({ estimateId, onClose, onCreated }: ProgressInvoiceDialogProps) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [amount, setAmount] = useState('');
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estimateId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBilling(null);
    fetch(`/api/crm/estimates/${estimateId}/billing`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setBilling(data);
        setAmount(((data.remainingCents ?? 0) / 100).toFixed(2));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the estimate');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [estimateId]);

  const remaining = billing?.remainingCents ?? 0;

  const create = async () => {
    if (!estimateId || !billing) return;
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isInteger(cents) || cents <= 0) {
      setError('Enter an amount to bill');
      return;
    }
    if (cents > remaining) {
      setError('That amount is more than the remaining balance');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          estimateId,
          amountCents: cents,
          paidNow,
          paidNowMethod: method,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create the invoice');
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the invoice');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(estimateId)} onClose={() => !saving && onClose()} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={saving}>
      <div className="space-y-4 p-6">
        <h2 className="text-xl font-bold text-gray-900">Invoice this estimate</h2>
        {loading && <p className="text-sm text-gray-500">Loading the balance…</p>}
        {billing && (
          <>
            <p className="text-sm text-gray-600">
              Contract {money(billing.contractCents)}. Already billed {money(billing.billedCents)}. Still open {money(billing.remainingCents)}.
            </p>
            {billing.invoices.length > 0 && (
              <ul className="space-y-1 text-sm text-gray-600">
                {billing.invoices.map((invoice) => (
                  <li key={invoice.id}>
                    {invoice.invoice_number} · {money(invoice.amount_cents)} · {invoice.status}
                  </li>
                ))}
              </ul>
            )}
            {remaining > 0 ? (
              <>
                <label className="block text-sm font-medium text-gray-900">
                  Amount to bill
                  <Input
                    className="mt-1"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setAmount((remaining / 200).toFixed(2))}>
                    Half of what is left
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setAmount((remaining / 100).toFixed(2))}>
                    Invoice the rest
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} />
                  Customer paid this now
                </label>
                {paidNow && (
                  <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </Select>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-700">This estimate is fully billed. Cancel an invoice if you need to bill it again.</p>
            )}
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClose}>Close</Button>
          <Button type="button" size="sm" disabled={saving || loading || remaining <= 0} onClick={() => void create()}>
            {saving ? 'Creating…' : 'Create invoice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
