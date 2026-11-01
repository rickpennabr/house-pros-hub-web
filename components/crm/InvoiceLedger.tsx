'use client';

import { useState } from 'react';
import { Ban, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import {
  canCancelInvoice,
  canRecordPayment,
  invoiceStatusLabel,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  todayDateKey,
  type ProInvoiceStatus,
} from '@/lib/crm/invoice-books';

export interface LedgerPayment {
  id: string;
  amount_cents: number;
  payment_date: string;
  method: string;
  reference: string | null;
  note: string | null;
  voided_at: string | null;
}

export interface LedgerEvent {
  id: string;
  action: string;
  created_at: string;
}

interface InvoiceLedgerProps {
  invoiceId: string;
  status: ProInvoiceStatus;
  amountCents: number;
  payments: LedgerPayment[];
  events: LedgerEvent[];
  onChanged: () => Promise<void> | void;
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

const eventLabel: Record<string, string> = {
  sent: 'Sent',
  payment_recorded: 'Payment recorded',
  payment_voided: 'Payment voided',
  cancelled: 'Cancelled',
  reminded: 'Reminder sent',
  recurred: 'Created from schedule',
};

export function InvoiceLedger({
  invoiceId,
  status,
  amountCents,
  payments,
  events,
  onChanged,
}: InvoiceLedgerProps) {
  const paid = payments.reduce((sum, payment) => (payment.voided_at ? sum : sum + payment.amount_cents), 0);
  const balance = Math.max(0, amountCents - paid);
  const activeCount = payments.filter((payment) => !payment.voided_at).length;
  const [payOpen, setPayOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayDateKey());
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<(typeof RECURRING_FREQUENCIES)[number]>('monthly');
  const [nextRunDate, setNextRunDate] = useState(todayDateKey());
  const [endDate, setEndDate] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 border-t border-gray-200 pt-6 no-print">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Payments</h2>
          <p className="text-sm text-gray-500">Balance due {money(balance)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRecordPayment(status) && balance > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setAmount((balance / 100).toFixed(2));
                setError(null);
                setPayOpen(true);
              }}
            >
              Record payment
            </Button>
          )}
          {status !== 'cancelled' && (
            <Button variant="secondary" size="sm" onClick={() => { setError(null); setRepeatOpen(true); }} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Repeat
            </Button>
          )}
          {canCancelInvoice(status, activeCount) && (
            <Button variant="secondary" size="sm" onClick={() => { setError(null); setCancelOpen(true); }} className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Cancel invoice
            </Button>
          )}
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
          {payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-gray-900">{money(payment.amount_cents)}</span>
                <span className="text-gray-500"> · {payment.payment_date} · {payment.method}</span>
                {payment.reference && <span className="text-gray-500"> · {payment.reference}</span>}
                {payment.voided_at && <span className="ml-2 text-red-600">Voided</span>}
              </div>
              {!payment.voided_at && status !== 'cancelled' && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline cursor-pointer"
                  onClick={() => { setError(null); setVoidId(payment.id); }}
                >
                  Void
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {events.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Activity</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            {events.map((event) => (
              <li key={event.id}>
                {eventLabel[event.action] ?? event.action}
                <span className="text-gray-400"> · {new Date(event.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal isOpen={payOpen} onClose={() => !busy && setPayOpen(false)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={busy}>
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Record payment</h2>
          <p className="text-sm text-gray-600">Balance due {money(balance)}. Status becomes {invoiceStatusLabel(status)} until the balance is covered.</p>
          <FormField label="Amount">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Date">
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </FormField>
          <FormField label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}>
              {PAYMENT_METHODS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check or confirmation number" />
          </FormField>
          <FormField label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setPayOpen(false)}>Close</Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(async () => {
                const cents = Math.round(parseFloat(amount) * 100);
                const res = await fetch(`/api/crm/invoices/${invoiceId}/payments`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ amountCents: cents, paymentDate, method, reference, note }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Could not record payment');
                setPayOpen(false);
                await onChanged();
              })}
            >
              {busy ? 'Saving…' : 'Save payment'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={repeatOpen} onClose={() => !busy && setRepeatOpen(false)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={busy}>
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Repeat this invoice</h2>
          <p className="text-sm text-gray-600">The schedule copies this customer, lines, and total. A new draft is created on each date and emailed when the customer has an address.</p>
          <FormField label="How often">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as (typeof RECURRING_FREQUENCIES)[number])}>
              {RECURRING_FREQUENCIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Next invoice date">
            <Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} />
          </FormField>
          <FormField label="End date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRepeatOpen(false)}>Close</Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await fetch('/api/crm/invoices/recurring', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    invoiceId,
                    frequency,
                    nextRunDate,
                    endDate: endDate || null,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Could not save the schedule');
                setRepeatOpen(false);
              })}
            >
              {busy ? 'Saving…' : 'Save schedule'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={cancelOpen} onClose={() => !busy && setCancelOpen(false)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={busy}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel invoice?</h2>
          <p className="text-sm text-gray-600 mb-4">This invoice has no payments. Cancelling keeps the number and removes it from what the customer owes.</p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setCancelOpen(false)}>Back</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await fetch(`/api/crm/invoices/${invoiceId}/cancel`, { method: 'POST', credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Could not cancel');
                setCancelOpen(false);
                await onChanged();
              })}
            >
              {busy ? 'Cancelling…' : 'Cancel invoice'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(voidId)} onClose={() => !busy && setVoidId(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={busy}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Void payment?</h2>
          <p className="text-sm text-gray-600 mb-4">The payment stays in the history and the balance goes back on the invoice.</p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setVoidId(null)}>Back</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={busy || !voidId}
              onClick={() => run(async () => {
                const res = await fetch(`/api/crm/invoices/${invoiceId}/payments/${voidId}/void`, {
                  method: 'POST',
                  credentials: 'include',
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Could not void payment');
                setVoidId(null);
                await onChanged();
              })}
            >
              {busy ? 'Voiding…' : 'Void payment'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
