'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { InvoiceEditor } from '@/components/invoices/InvoiceEditor';
import { uploadPendingAttachments, type SavedAttachment } from '@/components/invoices/InvoiceAttachments';
import { DOCUMENT_FORM_LAYOUT } from '@/lib/constants/documentFormLayout';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import {
  EMPTY_INVOICE_BUSINESS,
  emptyInvoiceLine,
  invoiceLineItemsPayload,
  invoiceTotalCents,
  type InvoiceBusinessShape,
  type InvoiceCustomerOption,
  type InvoiceEditorDraft,
  type InvoiceLineItem,
} from '@/lib/invoices/draft';
import { todayISO } from '@/lib/invoices/format';

export default function CRMEditInvoicePage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const id = params?.id as string | undefined;

  const [themeColorHex, setThemeColorHex] = useState('#000000');
  const [customers, setCustomers] = useState<InvoiceCustomerOption[]>([]);
  const [draft, setDraft] = useState<InvoiceEditorDraft | null>(null);
  const [business, setBusiness] = useState<InvoiceBusinessShape | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [savedAttachments, setSavedAttachments] = useState<SavedAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/crm/invoices/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([inv, cust]) => {
        if (inv.error) throw new Error(inv.error);
        if (inv.status !== 'draft') {
          router.replace(`/${locale}/crm/invoices/${id}`);
          return;
        }
        setThemeColorHex(inv.themeColorHex ?? '#000000');
        setInvoiceNumber(inv.invoiceNumber ?? '');
        setSavedAttachments(
          (inv.attachments ?? []).map((attachment: SavedAttachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            url: attachment.url,
            fileSizeBytes: attachment.fileSizeBytes,
            contentType: attachment.contentType,
          }))
        );
        const items = inv.lineItems;
        const lineItems: InvoiceLineItem[] =
          Array.isArray(items) && items.length > 0
            ? items.map((line: Partial<InvoiceLineItem>) => ({
                product_or_service: line.product_or_service ?? '',
                description: line.description ?? '',
                unit: line.unit ?? DEFAULT_UNIT,
                qty: line.qty ?? 1,
                rate_cents: line.rate_cents ?? 0,
                amount_cents: line.amount_cents ?? 0,
                expense_id: line.expense_id ?? null,
                cost_cents: line.cost_cents ?? null,
              }))
            : [emptyInvoiceLine()];
        setDraft({
          customerId: inv.customerId ?? '',
          lineItems,
          invoiceDate: inv.invoiceDate ?? todayISO(),
          dueDate: inv.dueDate ?? '',
          paymentTerms: inv.paymentTerms ?? 'Due on receipt',
          note: inv.note ?? '',
          companyOverride: inv.companyDisplay ?? null,
          pendingAttachments: [],
          paidNow: false,
          paidNowMethod: 'cash',
        });
        if (inv.business) {
          setBusiness({
            id: inv.business.id,
            business_name: inv.business.business_name,
            business_logo: inv.business.business_logo,
            email: inv.business.email,
            phone: inv.business.phone,
            address: inv.business.address,
            company_tagline: inv.business.company_tagline,
            website: inv.business.website,
          });
        } else {
          setBusiness(EMPTY_INVOICE_BUSINESS);
        }
        setCustomers(cust.customers ?? []);
      })
      .catch(() => setError('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id, locale, router]);

  const patchInvoice = async (form: InvoiceEditorDraft) => {
    const lineItems = invoiceLineItemsPayload(form.lineItems);
    const res = await fetch(`/api/crm/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        customerId: form.customerId,
        amountCents: invoiceTotalCents(lineItems),
        lineItems: lineItems.length > 0 ? lineItems : null,
        invoiceDate: form.invoiceDate || todayISO(),
        dueDate: form.dueDate || null,
        paymentTerms: form.paymentTerms.trim() || null,
        note: form.note.trim() || null,
        companyDisplay: form.companyOverride ?? undefined,
        paidNow: form.paidNow,
        paidNowMethod: form.paidNowMethod,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update invoice');
  };

  const saveDraft = async (form: InvoiceEditorDraft) => {
    await patchInvoice(form);
    if (id) await uploadPendingAttachments(id, form.pendingAttachments);
  };

  const handleSaveAndClose = async (form: InvoiceEditorDraft) => {
    setError(null);
    setSaving(true);
    try {
      await saveDraft(form);
      router.push(`/${locale}/crm/invoices`);
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
      await saveDraft(form);
      router.push(`/${locale}/crm/invoices/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/crm/invoices/${id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove attachment');
      setSavedAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    } catch {
      setError('Failed to remove attachment');
    }
  };

  if (!id) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Invoice ID missing.</p>
        <Link href={`/${locale}/crm/invoices`} className="text-black underline mt-2 inline-block">
          Back to Invoices
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${DOCUMENT_FORM_LAYOUT.pageContainer} py-12 text-center text-gray-500 text-sm`}>
        Loading…
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error}</p>
        <Link href={`/${locale}/crm/invoices`} className="text-black underline mt-2 inline-block">
          Back to Invoices
        </Link>
      </div>
    );
  }

  if (!business || !draft) {
    return (
      <div className={`${DOCUMENT_FORM_LAYOUT.pageContainer} py-12 text-center text-gray-500 text-sm`}>
        Loading…
      </div>
    );
  }

  return (
    <InvoiceEditor
      title={invoiceNumber ? `Edit Invoice ${invoiceNumber}` : 'Edit Invoice'}
      backHref={`/${locale}/crm/invoices/${id}`}
      invoiceNumber={invoiceNumber}
      themeColorHex={themeColorHex}
      business={business}
      customers={customers}
      invoiceId={id}
      savedAttachments={savedAttachments}
      onSavedAttachmentRemove={handleRemoveAttachment}
      initialDraft={draft}
      error={error}
      saving={saving}
      onSaveAndClose={handleSaveAndClose}
      onReviewAndSend={handleReviewAndSend}
    />
  );
}
