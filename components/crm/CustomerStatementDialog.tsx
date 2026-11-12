'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface StatementInvoice {
  id: string;
  invoiceNumber: string;
  dueDate: string | null;
  balanceCents: number;
  status: string;
}

interface Statement {
  customerName: string;
  email: string | null;
  invoices: StatementInvoice[];
  totalCents: number;
}

interface CustomerStatementDialogProps {
  customerId: string | null;
  onClose: () => void;
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

export function CustomerStatementDialog({ customerId, onClose }: CustomerStatementDialogProps) {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSentTo(null);
    setStatement(null);
    fetch(`/api/crm/customers/${customerId}/statement`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setStatement(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the statement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const send = async () => {
    if (!customerId) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/customers/${customerId}/statement`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not send the statement');
      setSentTo(data.sentTo ?? statement?.email ?? 'the customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the statement');
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(statement?.email) && (statement?.invoices.length ?? 0) > 0;

  return (
    <Modal isOpen={Boolean(customerId)} onClose={() => !sending && onClose()} showHeader={false} showCloseButton maxWidth="md" preventCloseOnOverlayClick={sending}>
      <div className="space-y-4 p-6">
        <h2 className="text-xl font-bold text-gray-900">Statement</h2>
        {loading && <p className="text-sm text-gray-500">Loading open invoices…</p>}
        {statement && (
          <>
            <p className="text-sm text-gray-600">
              {statement.customerName}
              {statement.email ? ` · ${statement.email}` : ' · no email on file'}
            </p>
            {statement.invoices.length === 0 ? (
              <p className="text-sm text-gray-700">Nothing is open. Drafts and paid invoices stay off the statement.</p>
            ) : (
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {statement.invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                      <span className="text-gray-500"> · due {invoice.dueDate || '—'} · {invoice.status}</span>
                    </span>
                    <span className="font-medium">{money(invoice.balanceCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-base font-semibold text-gray-900">Total due {money(statement.totalCents)}</p>
          </>
        )}
        {sentTo && <p className="text-sm text-gray-800">Statement emailed to {sentTo}.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={sending} onClick={onClose}>Close</Button>
          <Button type="button" size="sm" disabled={sending || loading || !canSend} onClick={() => void send()}>
            {sending ? 'Sending…' : 'Email statement'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
