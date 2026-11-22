'use client';

import { discountedTotalCents } from '@/lib/crm/document-discount';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { InvoiceEditor } from '@/components/invoices/InvoiceEditor';
import { uploadPendingAttachments } from '@/components/invoices/InvoiceAttachments';
import { DOCUMENT_FORM_LAYOUT } from '@/lib/constants/documentFormLayout';
import {
  EMPTY_INVOICE_BUSINESS,
  emptyInvoiceLine,
  invoiceLineItemsPayload,
  invoiceTotalCents,
  invoiceDraftDiscount,
  type InvoiceBusinessShape,
  type InvoiceCustomerOption,
  type InvoiceEditorDraft,
} from '@/lib/invoices/draft';
import { todayISO } from '@/lib/invoices/format';
import { dueDateForTerms } from '@/lib/invoices/invoice-brand';
import { chatReturnWithDoc, safeChatReturnTo } from '@/lib/chat/crm-doc-share';

/** Defaults from Invoice settings: payment terms (and the due date they give) and the message. */
type InvoiceDefaults = { paymentTerms: string | null; note: string | null };

function blankDraft(customerId = '', defaults: InvoiceDefaults = { paymentTerms: null, note: null }): InvoiceEditorDraft {
  const today = todayISO();
  const paymentTerms = defaults.paymentTerms || 'Due on receipt';
  return {
    customerId,
    lineItems: [emptyInvoiceLine()],
    invoiceDate: today,
    dueDate: dueDateForTerms(today, paymentTerms) ?? today,
    paymentTerms,
    note: defaults.note ?? '',
    companyOverride: null,
    pendingAttachments: [],
    paidNow: false,
    paidNowMethod: 'cash',
  };
}

export default function CRMNewInvoicePage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [context, setContext] = useState<{
    themeColorHex: string;
    nextInvoiceNumber: string;
    business: InvoiceBusinessShape;
  } | null>(null);
  const [customers, setCustomers] = useState<InvoiceCustomerOption[]>([]);
  const [draft, setDraft] = useState<InvoiceEditorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Opened from a chat: go back to it after saving, and the chat attaches the invoice. */
  const chatReturnTo = safeChatReturnTo(searchParams.get('returnTo'));
  /** Opened from "Send payment link": after saving, open the invoice with its payment link ready. */
  const payNext = searchParams.get('pay') === '1';

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/invoices/new-context', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([ctx, cust]) => {
        if (ctx.error) throw new Error(ctx.error);
        setContext({
          themeColorHex: ctx.themeColorHex ?? '#000000',
          nextInvoiceNumber: ctx.nextInvoiceNumber ?? 'INV-0001',
          business: ctx.business ?? EMPTY_INVOICE_BUSINESS,
        });
        const list: InvoiceCustomerOption[] = cust.customers ?? [];
        setCustomers(list);
        const customerId = searchParams.get('customerId');
        const selected = customerId && list.some((customer) => customer.id === customerId) ? customerId : '';
        setDraft(blankDraft(selected, { paymentTerms: ctx.defaultPaymentTerms ?? null, note: ctx.defaultNote ?? null }));
      })
      .catch(() => {
        setContext({
          themeColorHex: '#000000',
          nextInvoiceNumber: 'INV-0001',
          business: EMPTY_INVOICE_BUSINESS,
        });
        setCustomers([]);
        setDraft(blankDraft());
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const createInvoice = async (form: InvoiceEditorDraft): Promise<string> => {
    const lineItems = invoiceLineItemsPayload(form.lineItems);
    const res = await fetch('/api/crm/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        customerId: form.customerId,
        placeId: form.placeId || null,
        amountCents: discountedTotalCents(invoiceTotalCents(lineItems), invoiceDraftDiscount(form)),
        discount: invoiceDraftDiscount(form),
        lineItems: lineItems.length > 0 ? lineItems : null,
        invoiceDate: form.invoiceDate || todayISO(),
        dueDate: form.dueDate.trim() || form.invoiceDate || todayISO(),
        paymentTerms: form.paymentTerms.trim() || null,
        note: form.note.trim() || null,
        companyDisplay: form.companyOverride ?? undefined,
        paidNow: form.paidNow,
        paidNowMethod: form.paidNowMethod,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
    return data.id;
  };

  const handleSaveAndClose = async (form: InvoiceEditorDraft) => {
    setError(null);
    setSaving(true);
    try {
      const id = await createInvoice(form);
      await uploadPendingAttachments(id, form.pendingAttachments);
      router.push(
        chatReturnTo
          ? chatReturnWithDoc(chatReturnTo, 'invoice', id)
          : payNext
            ? `/${locale}/crm/invoices/${id}?pay=1`
            : `/${locale}/crm/invoices`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAndSend = async (form: InvoiceEditorDraft) => {
    setError(null);
    setSaving(true);
    try {
      const id = await createInvoice(form);
      await uploadPendingAttachments(id, form.pendingAttachments);
      router.push(
        chatReturnTo
          ? chatReturnWithDoc(chatReturnTo, 'invoice', id)
          : `/${locale}/crm/invoices/${id}${payNext ? '?pay=1' : ''}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !context || !draft) {
    return (
      <div className={`${DOCUMENT_FORM_LAYOUT.pageContainer} py-12 text-center text-gray-500 text-sm`}>
        Loading…
      </div>
    );
  }

  return (
    <InvoiceEditor
      title={chatReturnTo ? 'New Invoice · sends in chat when saved' : 'New Invoice'}
      backHref={chatReturnTo ?? `/${locale}/crm/invoices`}
      invoiceNumber={context.nextInvoiceNumber}
      themeColorHex={context.themeColorHex}
      business={context.business}
      customers={customers}
      invoiceId={null}
      initialDraft={draft}
      error={error}
      saving={saving}
      onSaveAndClose={handleSaveAndClose}
      onReviewAndSend={handleReviewAndSend}
    />
  );
}
