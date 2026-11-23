'use client';

import { useState } from 'react';
import { BellRing, CircleCheck, CircleX, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface BulkReminderInvoice {
  id: string;
  number: string;
  customer: string;
  balanceLabel: string;
  dueLabel: string;
}

type Result = { ok: true; to: string } | { ok: false; error: string };

/**
 * Send payment reminders for several late invoices at once. Each one uses the default reminder
 * message from invoice settings, plus an optional note added here.
 */
export function BulkInvoiceReminderDialog({
  invoices,
  onClose,
  onDone,
}: {
  /** Open when non-empty. Only invoices that can get a reminder. */
  invoices: BulkReminderInvoice[];
  onClose: () => void;
  onDone?: (sent: number) => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const finished = Object.keys(results).length === invoices.length && invoices.length > 0;

  const close = () => {
    if (sending) return;
    setResults({});
    setMessage('');
    onClose();
  };

  const sendAll = async () => {
    setSending(true);
    let sent = 0;
    // One at a time so the email provider is not flooded and each result shows as it lands.
    for (const invoice of invoices) {
      if (results[invoice.id]?.ok) continue;
      try {
        const res = await fetch(`/api/crm/invoices/${invoice.id}/reminder`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          // Empty note: the server uses the default reminder message.
          body: JSON.stringify(message.trim() ? { message: message.trim() } : {}),
        });
        const data = await res.json().catch(() => ({}));
        const result: Result = res.ok ? { ok: true, to: data.sentTo ?? '' } : { ok: false, error: data.error || 'Failed' };
        if (result.ok) sent += 1;
        setResults((current) => ({ ...current, [invoice.id]: result }));
      } catch {
        setResults((current) => ({ ...current, [invoice.id]: { ok: false, error: 'Network error' } }));
      }
    }
    setSending(false);
    onDone?.(sent);
  };

  return (
    <Modal
      isOpen={invoices.length > 0}
      onClose={close}
      title={`Send ${invoices.length} payment ${invoices.length === 1 ? 'reminder' : 'reminders'}`}
      showHeader
      showCloseButton
      maxWidth="lg"
      preventCloseOnOverlayClick={sending}
    >
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-700">
          Each customer gets their own branded reminder with the balance, due date and a pay link.
        </p>
        <ul className="max-h-72 divide-y divide-gray-200 overflow-y-auto rounded-lg border-2 border-black">
          {invoices.map((invoice) => {
            const result = results[invoice.id];
            return (
              <li key={invoice.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span className="mt-0.5 shrink-0">
                  {result ? (
                    result.ok ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : <CircleX className="h-4 w-4 text-red-600" />
                  ) : sending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <BellRing className="h-4 w-4 text-red-600" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{invoice.number}</span> · {invoice.customer}
                  <span className="block text-xs text-red-600">{invoice.dueLabel}</span>
                  {result && !result.ok ? <span className="block text-xs text-red-700">{result.error}</span> : null}
                  {result?.ok && result.to ? <span className="block text-xs text-emerald-700">Sent to {result.to}</span> : null}
                </span>
                <span className="shrink-0 font-semibold">{invoice.balanceLabel}</span>
              </li>
            );
          })}
        </ul>
        {!finished ? (
          <label className="block text-sm font-medium">
            Note for all (optional)
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              maxLength={2000}
              disabled={sending}
              placeholder="Leave blank to use your default reminder message"
              className="mt-1 block w-full rounded-lg border-2 border-black px-3 py-2 text-sm font-normal"
            />
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={close} disabled={sending}>
            {finished ? 'Done' : 'Cancel'}
          </Button>
          {!finished ? (
            <Button type="button" size="sm" variant="primary" onClick={() => void sendAll()} disabled={sending} className="inline-flex items-center gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              {sending ? 'Sending…' : `Send ${invoices.length}`}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
