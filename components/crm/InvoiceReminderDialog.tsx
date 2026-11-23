'use client';

import { useEffect, useState } from 'react';
import { BellRing, Loader2, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface Preview {
  to: string;
  subject: string;
  html: string;
  defaultMessage: string | null;
  daysOverdue: number;
  balanceCents: number;
}

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/**
 * Confirm and send a payment reminder. Shows who it goes to and a live preview of the branded email;
 * the pro can edit the note before sending.
 */
export function InvoiceReminderDialog(props: {
  invoiceId: string | null;
  invoiceNumber?: string;
  onClose: () => void;
  onSent?: (sentTo: string) => void;
}) {
  // A fresh body each time it opens, so no state carries over between invoices.
  return props.invoiceId ? <ReminderBody key={props.invoiceId} {...props} invoiceId={props.invoiceId} /> : null;
}

function ReminderBody({
  invoiceId,
  invoiceNumber,
  onClose,
  onSent,
}: {
  invoiceId: string;
  invoiceNumber?: string;
  onClose: () => void;
  onSent?: (sentTo: string) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First load: the default note from invoice settings.
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/crm/invoices/${invoiceId}/reminder`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Could not load the reminder');
        setPreview(data as Preview);
        setMessage((data as Preview).defaultMessage ?? '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the reminder');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  // Refresh the preview a moment after the note changes.
  useEffect(() => {
    if (!invoiceId || message === null || !preview) return;
    if (message === (preview.defaultMessage ?? '')) return;
    const handle = window.setTimeout(() => {
      void fetch(`/api/crm/invoices/${invoiceId}/reminder?message=${encodeURIComponent(message)}`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.html) setPreview((current) => (current ? { ...current, html: data.html } : current));
        });
    }, 600);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the note drives a refresh
  }, [message]);

  const send = async () => {
    if (!invoiceId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/invoices/${invoiceId}/reminder`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message ?? '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the reminder');
      onSent?.(data.sentTo ?? preview?.to ?? '');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reminder');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => !sending && onClose()}
      title={invoiceNumber ? `Send payment reminder · ${invoiceNumber}` : 'Send payment reminder'}
      showHeader
      showCloseButton
      maxWidth="2xl"
      preventCloseOnOverlayClick={sending}
    >
      <div className="space-y-3 p-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing the reminder…
          </p>
        ) : null}
        {preview ? (
          <>
            <div className="flex items-start gap-3 rounded-lg border-2 border-black p-3">
              <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {preview.daysOverdue > 0
                    ? `${money(preview.balanceCents)} is ${preview.daysOverdue} ${preview.daysOverdue === 1 ? 'day' : 'days'} overdue`
                    : `${money(preview.balanceCents)} is due today`}
                </p>
                <p className="truncate text-gray-700">
                  To <span className="font-medium text-black">{preview.to}</span>
                </p>
                <p className="truncate text-gray-500">Subject: {preview.subject}</p>
              </div>
            </div>
            <label className="block text-sm font-medium">
              Message (optional)
              <textarea
                value={message ?? ''}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Add a short, friendly note…"
                className="mt-1 block w-full rounded-lg border-2 border-black px-3 py-2 text-sm font-normal"
              />
            </label>
            <div className="overflow-hidden rounded-lg border-2 border-gray-200">
              <iframe title="Reminder email preview" srcDoc={preview.html} className="h-[420px] w-full bg-gray-100" sandbox="" />
            </div>
          </>
        ) : null}
        {error ? <p className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={() => void send()} disabled={!preview || sending} className="inline-flex items-center gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send reminder'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
