'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BellRing, Check, Clock, FileText, Loader2, Phone, Receipt, Send, X } from 'lucide-react';
import ChatDocCard from '@/components/chat/ChatDocCard';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InvoiceReminderDialog } from '@/components/crm/InvoiceReminderDialog';
import type { ChatProbotFollowup } from '@/lib/types/chat';

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * ProBot morning card: an unpaid invoice or an unanswered estimate.
 * Send opens a preview first; nothing goes to the customer until the pro taps Send there.
 * Read-only when an admin looks at the thread.
 */
export function ProbotFollowupCard({ card, canAnswer }: { card: ChatProbotFollowup; canAnswer: boolean }) {
  const locale = useLocale();
  const [state, setState] = useState(card);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const isInvoice = state.kind === 'invoice_unpaid';

  const record = async (action: 'sent' | 'snooze' | 'done') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/probot/followups/${state.followupId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: ChatProbotFollowup['status']; snoozedUntil?: string | null; actedAt?: string | null; error?: string };
      if (!res.ok || !data.status) throw new Error(data.error || 'Could not save');
      setState((current) => ({ ...current, status: data.status!, snoozedUntil: data.snoozedUntil ?? undefined, actedAt: data.actedAt ?? undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const docHref = isInvoice ? `/${locale}/crm/invoices/${state.documentId}` : `/${locale}/crm/estimates?id=${state.documentId}`;
  const late = isInvoice && state.daysLate ? state.daysLate : 0;

  return (
    <ChatDocCard
      tone={isInvoice ? 'invoice' : 'estimate'}
      icon={isInvoice ? <Receipt className="h-5 w-5" aria-hidden /> : <FileText className="h-5 w-5" aria-hidden />}
      eyebrow={isInvoice ? (late ? 'Invoice late' : 'Invoice unpaid') : 'Estimate waiting'}
      title={state.customerName}
      subtitle={`${isInvoice ? 'Invoice' : 'Estimate'} ${state.documentNumber} · ${money(state.amountCents)}`}
    >
      <div className="space-y-2.5 bg-gray-50 px-3 py-3 text-sm">
        <p className="text-gray-800">
          {late ? <span className="font-semibold text-red-700">{late} {late === 1 ? 'day' : 'days'} late. </span> : null}
          {state.followedUpBefore ? 'Last follow-up' : 'Sent'} {state.waitingDays} days ago, no {isInvoice ? 'payment' : 'answer'} yet.
        </p>

        {state.status === 'sent' ? (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <Check className="h-3.5 w-3.5" />
            {isInvoice ? 'Reminder sent' : 'Follow-up sent'}{state.actedAt ? ` ${shortDate(state.actedAt)}` : ''}
          </p>
        ) : state.status === 'snoozed' ? (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
            <Clock className="h-3.5 w-3.5" />
            Snoozed{state.snoozedUntil ? ` until ${new Date(`${state.snoozedUntil}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
          </p>
        ) : state.status === 'done' ? (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
            <Check className="h-3.5 w-3.5" />
            Dismissed
          </p>
        ) : canAnswer ? (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => (isInvoice ? setReminderOpen(true) : setFollowupOpen(true))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
            >
              {isInvoice ? <BellRing className="h-4 w-4 text-red-500" /> : <Send className="h-4 w-4 text-red-500" />}
              {isInvoice ? 'Send reminder' : 'Send follow-up'}
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              {state.customerPhone ? (
                <a
                  href={`tel:${state.customerPhone.replace(/[^\d+]/g, '')}`}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:border-gray-500"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              ) : (
                <Link
                  href={docHref}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:border-gray-500"
                >
                  Open
                </Link>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void record('snooze')}
                className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:border-gray-500 disabled:opacity-60"
              >
                <Clock className="h-3.5 w-3.5" />
                3 days
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void record('done')}
                className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:border-gray-500 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </button>
            </div>
            {state.customerPhone ? (
              <Link href={docHref} className="block text-center text-xs font-medium text-gray-600 underline">
                Open {isInvoice ? 'invoice' : 'estimate'}
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Waiting for the pro.</p>
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>

      {reminderOpen ? (
        <InvoiceReminderDialog
          invoiceId={state.documentId}
          invoiceNumber={state.documentNumber}
          onClose={() => setReminderOpen(false)}
          onSent={() => {
            setReminderOpen(false);
            void record('sent');
          }}
        />
      ) : null}
      {followupOpen ? (
        <EstimateFollowupDialog
          estimateId={state.documentId}
          estimateNumber={state.documentNumber}
          customerName={state.customerName}
          onClose={() => setFollowupOpen(false)}
          onSent={() => {
            setFollowupOpen(false);
            void record('sent');
          }}
        />
      ) : null}
    </ChatDocCard>
  );
}

/** Re-send the estimate link with a short note. The pro can edit the note before sending. */
function EstimateFollowupDialog({
  estimateId,
  estimateNumber,
  customerName,
  onClose,
  onSent,
}: {
  estimateId: string;
  estimateNumber: string;
  customerName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const firstName = customerName.split(' ')[0] || customerName;
  const [message, setMessage] = useState(
    `Hi ${firstName}, just checking in on estimate ${estimateNumber}. Do you have any questions, or would you like to go ahead? Happy to walk you through it.`
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/estimates/${estimateId}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not send the follow-up');
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the follow-up');
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !sending && onClose()} title={`Follow up · Estimate ${estimateNumber}`} maxWidth="md">
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-600">{customerName} gets this note by email with a link to the estimate.</p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          maxLength={2000}
          className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={() => void send()} disabled={sending || !message.trim()}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
