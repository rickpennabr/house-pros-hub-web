'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, FolderOpen, Loader2, Plus, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import { todayISO } from '@/lib/invoices/format';

export type QuickDocKind = 'invoice' | 'estimate' | 'payment';

interface ChatQuickDocComposerProps {
  open: boolean;
  kind: QuickDocKind;
  /** Who the document is for (shown in the title). */
  customerName?: string;
  /** The chat customer's CRM record, adding them to the CRM first when needed. */
  ensureCustomerId: () => Promise<string>;
  /** Called with the saved document; the chat posts it as a card. */
  onCreated: (doc: { kind: QuickDocKind; id: string }) => Promise<void>;
  /** Full CRM editor for anything the quick form can't do; the chat attaches the document on return. */
  onOpenFullEditor: () => Promise<void>;
  /** Send one that already exists instead. */
  onPickSaved: () => void;
  onClose: () => void;
}

interface DraftLine {
  key: number;
  text: string;
  amount: string;
}

function toCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Quick estimate / invoice / payment request without leaving the chat.
 * Saves to the CRM like the full editor, then the chat posts it as a card the customer acts on.
 */
export default function ChatQuickDocComposer({
  open,
  kind,
  customerName,
  ensureCustomerId,
  onCreated,
  onOpenFullEditor,
  onPickSaved,
  onClose,
}: ChatQuickDocComposerProps) {
  const t = useTranslations('probot');
  // The chat mounts a fresh composer each time it opens. A payment request starts with one "Deposit" line.
  const [lines, setLines] = useState<DraftLine[]>(() => [
    { key: 1, text: kind === 'payment' ? t('crmComposerDepositLine') : '', amount: '' },
  ]);
  const [date, setDate] = useState(() => (kind === 'estimate' ? inDays(30) : todayISO()));
  const [deposit, setDeposit] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineItems = useMemo(
    () =>
      lines
        .map((line) => ({ text: line.text.trim(), cents: toCents(line.amount) }))
        .filter((line) => line.text && line.cents > 0)
        .map((line) => ({
          product_or_service: line.text,
          description: null,
          unit: DEFAULT_UNIT,
          qty: 1,
          rate_cents: line.cents,
          amount_cents: line.cents,
        })),
    [lines]
  );
  const totalCents = lineItems.reduce((sum, line) => sum + line.amount_cents, 0);
  const depositCents = kind === 'estimate' ? toCents(deposit) : 0;

  const title =
    kind === 'estimate'
      ? t('crmComposerEstimateTitle')
      : kind === 'payment'
        ? t('crmComposerPaymentTitle')
        : t('crmComposerInvoiceTitle');
  const submitLabel =
    kind === 'estimate'
      ? t('crmComposerSendEstimate')
      : kind === 'payment'
        ? t('crmComposerSendPayment')
        : t('crmComposerSendInvoice');

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const submit = async () => {
    if (lineItems.length === 0) {
      setError(t('crmComposerNeedItem'));
      return;
    }
    if (depositCents > totalCents) {
      setError(t('crmComposerDepositTooHigh'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const customerId = await ensureCustomerId();
      const trimmedNote = note.trim() || null;
      let id: string | null = null;
      if (kind === 'estimate') {
        const res = await fetch('/api/crm/estimates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            customerId,
            lineItems,
            status: 'draft',
            validityDate: date || null,
            note: trimmedNote,
            depositCents,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('crmComposerFailed'));
        id = typeof data.id === 'string' ? data.id : null;
      } else {
        const invoiceDate = todayISO();
        const res = await fetch('/api/crm/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            customerId,
            amountCents: totalCents,
            lineItems: lineItems.map((line) => ({ ...line, expense_id: null, cost_cents: null })),
            invoiceDate,
            dueDate: date || invoiceDate,
            paymentTerms: !date || date === invoiceDate ? 'Due on receipt' : null,
            note: trimmedNote,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('crmComposerFailed'));
        id = typeof data.id === 'string' ? data.id : null;
      }
      if (!id) throw new Error(t('crmComposerFailed'));
      await onCreated({ kind, id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crmComposerFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openFullEditor = async () => {
    setLeaving(true);
    setError(null);
    try {
      await onOpenFullEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crmComposerFailed'));
      setLeaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={saving ? () => {} : onClose}
      title={customerName ? `${title} · ${customerName}` : title}
      maxWidth="md"
      showHeader
      contentClassName="p-0"
    >
      <div className="flex max-h-[75vh] flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={line.key} className="flex items-center gap-2">
                <input
                  value={line.text}
                  onChange={(e) => updateLine(line.key, { text: e.target.value })}
                  placeholder={t('crmComposerItemPlaceholder')}
                  aria-label={t('crmComposerItem')}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                  autoFocus={index === 0}
                />
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                  <input
                    value={line.amount}
                    onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={t('crmComposerAmount')}
                    className="h-10 w-full rounded-lg border border-gray-300 pl-6 pr-2 text-right text-sm focus:border-black focus:outline-none"
                  />
                </div>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                    aria-label={t('crmComposerRemoveLine')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setLines((current) => [...current, { key: Math.max(0, ...current.map((item) => item.key)) + 1, text: '', amount: '' }])
              }
              className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-gray-700 hover:text-black"
            >
              <Plus className="h-4 w-4" />
              {t('crmComposerAddLine')}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-600">
              {kind === 'estimate' ? t('crmComposerValidUntil') : t('crmComposerDueDate')}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-black focus:outline-none"
              />
            </label>
            {kind === 'estimate' ? (
              <label className="block text-xs font-medium text-gray-600">
                {t('crmComposerDeposit')}
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                  <input
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-10 w-full rounded-lg border border-gray-300 pl-6 pr-2 text-sm text-gray-900 focus:border-black focus:outline-none"
                  />
                </div>
              </label>
            ) : null}
          </div>

          <label className="block text-xs font-medium text-gray-600">
            {t('crmComposerNote')}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
            />
          </label>

          <div className="flex items-baseline justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-600">{t('crmComposerTotal')}</span>
            <span className="text-lg font-bold text-gray-900">{money(totalCents)}</span>
          </div>
        </div>

        {error ? <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="space-y-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || leaving}
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? t('crmComposerSending') : submitLabel}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => void openFullEditor()}
              disabled={saving || leaving}
              className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-gray-700 hover:text-black disabled:opacity-60"
              title={t('crmComposerFullEditorHint')}
            >
              {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {t('crmComposerFullEditor')}
            </button>
            <button
              type="button"
              onClick={onPickSaved}
              disabled={saving || leaving}
              className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-gray-700 hover:text-black disabled:opacity-60"
            >
              <FolderOpen className="h-4 w-4" />
              {t('crmComposerPickSaved')}
            </button>
          </div>
          <p className="text-xs text-gray-500">{t('crmComposerFullEditorHint')}</p>
        </div>
      </div>
    </Modal>
  );
}
