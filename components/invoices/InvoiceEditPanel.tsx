'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { discountedTotalCents, discountFormText } from '@/lib/crm/document-discount';
import { InvoiceEditor } from '@/components/invoices/InvoiceEditor';
import { uploadPendingAttachments, type SavedAttachment } from '@/components/invoices/InvoiceAttachments';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import {
  EMPTY_INVOICE_BUSINESS,
  emptyInvoiceLine,
  invoiceLineItemsPayload,
  invoiceTotalCents,
  invoiceDraftDiscount,
  type InvoiceBusinessShape,
  type InvoiceCustomerOption,
  type InvoiceEditorDraft,
  type InvoiceLineItem,
} from '@/lib/invoices/draft';
import { todayISO } from '@/lib/invoices/format';

interface Loaded {
  themeColorHex: string;
  invoiceNumber: string;
  business: InvoiceBusinessShape;
  customers: InvoiceCustomerOption[];
  draft: InvoiceEditorDraft;
  attachments: SavedAttachment[];
  sent: { status: string; paidCents: number } | null;
}

/**
 * The invoice editor inside the invoice page's "Edit invoice" tab, for drafts and sent invoices
 * alike (like QuickBooks). Saving stays on the page and refreshes it; Save and close goes to the list.
 */
export function InvoiceEditPanel({ id, onSaved }: { id: string; onSaved: () => void }) {
  const router = useRouter();
  const locale = useLocale();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by Cancel and after a save: the editor starts again from the saved invoice. */
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/crm/invoices/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([inv, cust]) => {
        if (cancelled) return;
        if (inv.error) throw new Error(inv.error);
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
        setLoaded({
          themeColorHex: inv.themeColorHex ?? '#000000',
          invoiceNumber: inv.invoiceNumber ?? '',
          business: inv.business
            ? {
                id: inv.business.id,
                business_name: inv.business.business_name,
                business_logo: inv.business.business_logo,
                email: inv.business.email,
                phone: inv.business.phone,
                address: inv.business.address,
                company_tagline: inv.business.company_tagline,
                website: inv.business.website,
              }
            : EMPTY_INVOICE_BUSINESS,
          customers: cust.customers ?? [],
          attachments: (inv.attachments ?? []).map((attachment: SavedAttachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            url: attachment.url,
            fileSizeBytes: attachment.fileSizeBytes,
            contentType: attachment.contentType,
          })),
          sent: inv.status === 'draft' ? null : { status: inv.status, paidCents: inv.paymentAppliedCents ?? 0 },
          draft: {
            customerId: inv.customerId ?? '',
            placeId: typeof inv.placeId === 'string' ? inv.placeId : '',
            lineItems,
            invoiceDate: inv.invoiceDate ?? todayISO(),
            dueDate: inv.dueDate ?? '',
            paymentTerms: inv.paymentTerms ?? 'Due on receipt',
            poNumber: inv.poNumber ?? '',
            note: inv.note ?? '',
            companyOverride: inv.companyDisplay ?? null,
            pendingAttachments: [],
            paidNow: false,
            paidNowMethod: 'cash',
            discountKind: inv.discount?.kind ?? 'percent',
            discountValue: discountFormText(inv.discount),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load invoice');
      });
    return () => {
      cancelled = true;
    };
  }, [id, round]);

  const save = async (form: InvoiceEditorDraft) => {
    const lineItems = invoiceLineItemsPayload(form.lineItems);
    const res = await fetch(`/api/crm/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        customerId: form.customerId,
        placeId: form.placeId || null,
        amountCents: discountedTotalCents(invoiceTotalCents(lineItems), invoiceDraftDiscount(form)),
        discount: invoiceDraftDiscount(form),
        lineItems: lineItems.length > 0 ? lineItems : null,
        invoiceDate: form.invoiceDate || todayISO(),
        dueDate: form.dueDate || null,
        paymentTerms: form.paymentTerms.trim() || null,
        poNumber: form.poNumber?.trim() || null,
        note: form.note.trim() || null,
        companyDisplay: form.companyOverride ?? undefined,
        paidNow: form.paidNow,
        paidNowMethod: form.paidNowMethod,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update invoice');
    await uploadPendingAttachments(id, form.pendingAttachments);
  };

  const run = async (form: InvoiceEditorDraft, after: () => void) => {
    setError(null);
    setSaving(true);
    try {
      await save(form);
      after();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/crm/invoices/${id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove attachment');
      setLoaded((current) =>
        current ? { ...current, attachments: current.attachments.filter((item) => item.id !== attachmentId) } : current
      );
    } catch {
      setError('Failed to remove attachment');
    }
  };

  if (!loaded) {
    return error ? (
      <p className="py-8 text-center text-sm text-red-600">{error}</p>
    ) : (
      <p className="py-12 text-center text-sm text-gray-500">Loading…</p>
    );
  }

  return (
    <InvoiceEditor
      key={round}
      title={loaded.invoiceNumber ? `Invoice ${loaded.invoiceNumber}` : 'Invoice'}
      backHref={`/${locale}/crm/invoices/${id}`}
      invoiceNumber={loaded.invoiceNumber}
      themeColorHex={loaded.themeColorHex}
      business={loaded.business}
      customers={loaded.customers}
      invoiceId={id}
      savedAttachments={loaded.attachments}
      onSavedAttachmentRemove={removeAttachment}
      initialDraft={loaded.draft}
      error={error}
      saving={saving}
      sent={loaded.sent}
      inline={{
        onCancel: () => {
          setError(null);
          setRound((value) => value + 1);
        },
      }}
      onSaveAndClose={(form) => void run(form, () => router.push(`/${locale}/crm/invoices`))}
      onReviewAndSend={(form) =>
        void run(form, () => {
          setRound((value) => value + 1);
          onSaved();
        })
      }
    />
  );
}
