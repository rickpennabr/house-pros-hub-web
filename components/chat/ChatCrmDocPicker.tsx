'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Receipt } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { createEstimateShare, createInvoiceShare, type SharedCrmDoc } from '@/lib/chat/crm-doc-share';

export type ChatCrmDocKind = 'estimate' | 'invoice' | 'payment';

export interface ChatCrmDocPickerProps {
  open: boolean;
  kind: ChatCrmDocKind;
  locale: string;
  /** CRM customer id when the chat contact is linked */
  customerId?: string | null;
  title: string;
  emptyLabel: string;
  loadingLabel: string;
  sendLabel: string;
  createNewLabel: string;
  allDocsLabel: string;
  forCustomerLabel?: string;
  /** Show Estimates / Invoices / Unpaid tabs so one picker covers every saved document. */
  onKindChange?: (kind: ChatCrmDocKind) => void;
  tabLabels?: Record<ChatCrmDocKind, string>;
  /** Create a new one (the chat sends the pro to the CRM and brings them back with it attached). */
  onCreateNew?: () => void;
  onClose: () => void;
  /** Post the document in the chat as a card the customer acts on. */
  onSend: (doc: SharedCrmDoc & { id: string }) => Promise<void>;
}

interface DocRow {
  id: string;
  label: string;
  amountCents: number;
  status: string;
  secondary?: string;
}

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function ChatCrmDocPicker({
  open,
  kind,
  locale,
  customerId,
  title,
  emptyLabel,
  loadingLabel,
  sendLabel,
  createNewLabel,
  allDocsLabel,
  forCustomerLabel,
  onKindChange,
  tabLabels,
  onCreateNew,
  onClose,
  onSend,
}: ChatCrmDocPickerProps) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scopeCustomerOnly, setScopeCustomerOnly] = useState(Boolean(customerId));

  useEffect(() => {
    if (!open) return;
    setScopeCustomerOnly(Boolean(customerId));
  }, [open, customerId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDocs([]);

    const params = new URLSearchParams({ pageSize: '50', page: '1' });
    if (scopeCustomerOnly && customerId) params.set('customerId', customerId);

    const load = async () => {
      try {
        if (kind === 'estimate') {
          const res = await fetch(`/api/crm/estimates?${params}`, { credentials: 'include' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to load estimates');
          if (cancelled) return;
          setDocs(
            ((data.estimates ?? []) as Array<{
              id: string;
              display_id?: string | null;
              amount_cents?: number | null;
              status: string;
              customerFirstName?: string | null;
              customerLastName?: string | null;
              customerDisplayName?: string | null;
            }>).map((e) => ({
              id: e.id,
              label: String(e.display_id ?? e.id.slice(0, 8)),
              amountCents: e.amount_cents ?? 0,
              status: e.status,
              secondary:
                e.customerDisplayName ||
                [e.customerFirstName, e.customerLastName].filter(Boolean).join(' ') ||
                undefined,
            }))
          );
          return;
        }

        if (kind === 'payment') {
          params.set('unpaid', '1');
          params.set('deposit', '1');
        }
        const res = await fetch(`/api/crm/invoices?${params}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load invoices');
        if (cancelled) return;
        let rows = (data.invoices ?? []) as Array<{
          id: string;
          invoice_number: string;
          amount_cents: number;
          payment_applied_cents?: number;
          status: string;
          note?: string | null;
          customerFirstName?: string | null;
          customerLastName?: string | null;
          customerDisplayName?: string | null;
        }>;

        // Payment picker: if no deposit invoices, fall back to unpaid invoices.
        if (kind === 'payment' && rows.length === 0) {
          const unpaidParams = new URLSearchParams(params);
          unpaidParams.delete('deposit');
          unpaidParams.set('unpaid', '1');
          const unpaidRes = await fetch(`/api/crm/invoices?${unpaidParams}`, { credentials: 'include' });
          const unpaidData = await unpaidRes.json().catch(() => ({}));
          if (!unpaidRes.ok) throw new Error(unpaidData.error || 'Failed to load invoices');
          rows = unpaidData.invoices ?? [];
        }

        if (cancelled) return;
        setDocs(
          rows.map((inv) => ({
            id: inv.id,
            label: inv.invoice_number,
            amountCents: Math.max(0, (inv.amount_cents ?? 0) - (inv.payment_applied_cents ?? 0)),
            status: inv.status,
            secondary:
              inv.customerDisplayName ||
              [inv.customerFirstName, inv.customerLastName].filter(Boolean).join(' ') ||
              (inv.note?.includes('Deposit of') ? 'Deposit' : undefined),
          }))
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, kind, customerId, scopeCustomerOnly]);

  const createHref =
    kind === 'estimate'
      ? `/${locale}/crm/estimates${customerId ? `?customerId=${customerId}` : ''}`
      : `/${locale}/crm/invoices/new${customerId ? `?customerId=${customerId}` : ''}`;

  const handleSend = async (doc: DocRow) => {
    setSendingId(doc.id);
    setError(null);
    try {
      const shared =
        kind === 'estimate'
          ? await createEstimateShare(doc.id, doc.label)
          : await createInvoiceShare(doc.id, kind === 'payment' ? 'payment' : 'invoice', doc.label);
      await onSend({ id: doc.id, ...shared });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={title} maxWidth="md" showHeader contentClassName="p-0">
      <div className="flex flex-col max-h-[70vh]">
        {onKindChange && tabLabels ? (
          <div className="flex items-center gap-1 border-b border-gray-100 px-4 py-2" role="tablist">
            {(['estimate', 'invoice', 'payment'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={kind === tab}
                onClick={() => onKindChange(tab)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium ${
                  kind === tab ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        ) : null}
        {customerId ? (
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs">
            <button
              type="button"
              onClick={() => setScopeCustomerOnly(true)}
              className={`cursor-pointer rounded-full px-2.5 py-1 ${
                scopeCustomerOnly ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {forCustomerLabel || 'This customer'}
            </button>
            <button
              type="button"
              onClick={() => setScopeCustomerOnly(false)}
              className={`cursor-pointer rounded-full px-2.5 py-1 ${
                !scopeCustomerOnly ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {allDocsLabel}
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingLabel}
            </div>
          ) : docs.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">{emptyLabel}</p>
          ) : (
            <ul className="space-y-1">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    disabled={sendingId !== null}
                    onClick={() => void handleSend(doc)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
                      {kind === 'estimate' ? (
                        <FileText className="h-4 w-4 text-gray-700" />
                      ) : (
                        <Receipt className="h-4 w-4 text-gray-700" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {doc.label}
                        {doc.secondary ? (
                          <span className="font-normal text-gray-500"> · {doc.secondary}</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {money(doc.amountCents)} · {doc.status}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-black">
                      {sendingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : sendLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="border-t border-gray-100 px-4 py-3">
          {onCreateNew ? (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex cursor-pointer text-sm font-medium text-black underline hover:no-underline"
            >
              {createNewLabel}
            </button>
          ) : (
            <Link
              href={createHref}
              onClick={onClose}
              className="inline-flex text-sm font-medium text-black underline hover:no-underline"
            >
              {createNewLabel}
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}
