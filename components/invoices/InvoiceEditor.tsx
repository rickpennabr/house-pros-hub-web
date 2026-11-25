'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InvoiceCompanyEditor } from '@/components/invoices/InvoiceCompanyEditor';
import { DocumentBrandHeader } from '@/components/documents/DocumentBrandHeader';
import {
  InvoiceAttachments,
  type PendingAttachment,
  type SavedAttachment,
} from '@/components/invoices/InvoiceAttachments';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import { ProductOrServiceCombobox } from '@/components/invoices/ProductOrServiceCombobox';
import { UnitCombobox } from '@/components/invoices/UnitCombobox';
import { LineDescriptionInput } from '@/components/invoices/LineDescriptionInput';
import type { CompanyDisplayOverride } from '@/lib/invoices/companyDisplay';
import { useLocale } from 'next-intl';
import { InvoiceViewPreview, InvoiceViewTabs, type InvoiceView } from '@/components/invoices/InvoiceViews';
import type { InvoiceTemplateCustomer, InvoiceTemplateInvoice } from '@/components/invoices/InvoiceTemplate';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { HubCustomerImport } from '@/components/crm/HubCustomerImport';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import { DOCUMENT_FORM_LAYOUT, DOCUMENT_LINE_QTY_RATE } from '@/lib/constants/documentFormLayout';
import { formatAmount } from '@/lib/invoices/format';
import {
  emptyInvoiceLine,
  invoiceLineItemsPayload,
  invoiceTotalCents,
  type InvoiceBusinessShape,
  type InvoiceCustomerOption,
  type InvoiceEditorDraft,
  type InvoiceLineItem,
} from '@/lib/invoices/draft';
import { dueDateForTerms, PAYMENT_TERM_OPTIONS } from '@/lib/invoices/invoice-brand';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/crm/invoice-books';
import { JobCostPicker } from '@/components/invoices/JobCostPicker';
import { ContactPropertySelect } from '@/components/crm/ContactPropertySelect';
import { DiscountField } from '@/components/documents/DiscountField';
import { discountCents as discountCentsFor, discountFromForm, type DiscountKind } from '@/lib/crm/document-discount';
import type { ContactProperty } from '@/lib/places/contact-places';

interface InvoiceEditorProps {
  title: string;
  backHref: string;
  invoiceNumber: string;
  themeColorHex: string;
  business: InvoiceBusinessShape;
  customers: InvoiceCustomerOption[];
  /** Null on the create page. Edit passes the invoice id so saved files can be removed. */
  invoiceId: string | null;
  savedAttachments?: SavedAttachment[];
  onSavedAttachmentRemove?: (attachmentId: string) => void;
  initialDraft: InvoiceEditorDraft;
  error: string | null;
  saving: boolean;
  onSaveAndClose: (draft: InvoiceEditorDraft) => void;
  onReviewAndSend: (draft: InvoiceEditorDraft) => void;
  /**
   * Inside the chat: no Back row (the window has its own title), Cancel closes the window, one
   * primary button, and the customer is fixed.
   */
  /** The invoice was already sent (status and what is paid). Editing still works; the page says so. */
  sent?: { status: string; paidCents: number } | null;
  /**
   * Shown inside the invoice page's "Edit invoice" tab: that page has the back link and the view
   * tabs, so the editor drops its own; Cancel throws away the changes.
   */
  inline?: { onCancel: () => void };
  embedded?: {
    onCancel: () => void;
    submitLabel: string;
    /** Pick the house once the contact's houses load (the house shared in the chat). */
    onPropertiesLoaded?: (properties: ContactProperty[]) => string | void;
  };
}

function customerLabel(customer: InvoiceCustomerOption): string {
  return contactDisplayName(customer);
}

export function InvoiceEditor({
  title,
  backHref,
  invoiceNumber,
  themeColorHex,
  business,
  customers,
  invoiceId,
  savedAttachments = [],
  onSavedAttachmentRemove,
  initialDraft,
  error,
  saving,
  onSaveAndClose,
  onReviewAndSend,
  sent = null,
  inline,
  embedded,
}: InvoiceEditorProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialDraft.customerId);
  const [placeId, setPlaceId] = useState(initialDraft.placeId ?? '');
  const [importedCustomers, setImportedCustomers] = useState<InvoiceCustomerOption[]>([]);
  const customerOptions = useMemo(() => {
    const seen = new Set(customers.map((customer) => customer.id));
    return [...customers, ...importedCustomers.filter((customer) => !seen.has(customer.id))];
  }, [customers, importedCustomers]);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(initialDraft.lineItems);
  const [invoiceDate, setInvoiceDate] = useState(initialDraft.invoiceDate);
  const [dueDate, setDueDate] = useState(initialDraft.dueDate);
  const [paymentTerms, setPaymentTerms] = useState(initialDraft.paymentTerms);
  const [note, setNote] = useState(initialDraft.note);
  const [companyOverride, setCompanyOverride] = useState<CompanyDisplayOverride | null>(initialDraft.companyOverride);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>(initialDraft.pendingAttachments);
  const [paidNow, setPaidNow] = useState(initialDraft.paidNow);
  const [paidNowMethod, setPaidNowMethod] = useState<PaymentMethod>(initialDraft.paidNowMethod);
  const [reusableItems, setReusableItems] = useState<ProCrmItem[]>([]);
  const [addItemPanelOpen, setAddItemPanelOpen] = useState(false);
  const [addItemPanelRowIndex, setAddItemPanelRowIndex] = useState<number | null>(null);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [editingRateRowIndex, setEditingRateRowIndex] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm/items', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.items)) setReusableItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setReusableItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayBusiness: InvoiceBusinessShape = companyOverride ? { ...business, ...companyOverride } : business;
  const tintBg = themeColorHex && themeColorHex !== '#000000' ? `${themeColorHex}14` : 'rgba(0,0,0,0.06)';
  const [discountKind, setDiscountKind] = useState<DiscountKind>(initialDraft.discountKind ?? 'percent');
  const [discountValue, setDiscountValue] = useState(initialDraft.discountValue ?? '');
  const subtotalCents = invoiceTotalCents(invoiceLineItemsPayload(lineItems));
  const discountAmountCents = discountCentsFor(subtotalCents, discountFromForm(discountKind, discountValue));
  const totalAmountCents = subtotalCents - discountAmountCents;
  const shownError = validationError || error;
  const locale = useLocale();
  const [view, setView] = useState<InvoiceView>('edit');

  // The invoice as it is on screen, for the Email, Payor and PDF views.
  const previewInvoice = useMemo<InvoiceTemplateInvoice>(
    () => ({
      invoice_number: invoiceNumber || 'New',
      amount_cents: totalAmountCents,
      payment_applied_cents: 0,
      line_items: invoiceLineItemsPayload(lineItems),
      status: 'draft',
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      payment_terms: paymentTerms || null,
      note: note || null,
    }),
    [invoiceNumber, totalAmountCents, lineItems, invoiceDate, dueDate, paymentTerms, note]
  );
  const previewCustomer = useMemo<InvoiceTemplateCustomer>(() => {
    const picked = customerOptions.find((customer) => customer.id === customerId);
    return picked
      ? { first_name: picked.first_name, last_name: picked.last_name, display_name: picked.display_name, company_name: picked.company_name }
      : { first_name: '', last_name: '', billing_address: null };
  }, [customerOptions, customerId]);
  const previewBusiness = useMemo<InvoiceBusinessShape>(
    () => (companyOverride ? { ...business, ...companyOverride } : business),
    [business, companyOverride]
  );

  const currentDraft = (): InvoiceEditorDraft => ({
    customerId,
    placeId,
    lineItems,
    invoiceDate,
    dueDate,
    paymentTerms,
    note,
    companyOverride,
    pendingAttachments,
    paidNow,
    paidNowMethod,
    discountKind,
    discountValue,
  });

  const addLine = () => {
    setEditingRateRowIndex(null);
    setLineItems([...lineItems, emptyInvoiceLine()]);
  };

  const clearLines = () => {
    setEditingRateRowIndex(null);
    setLineItems([emptyInvoiceLine()]);
  };

  const applyItemToRow = (item: ProCrmItem, rowIndex: number) => {
    setEditingRateRowIndex(null);
    setLineItems((prev) => {
      const next = [...prev];
      if (rowIndex >= 0 && rowIndex < next.length) {
        next[rowIndex] = {
          ...next[rowIndex],
          product_or_service: item.name,
          // A service's own description is for the pro page; on the invoice the pro writes (or
          // picks a saved) description for this job. Products keep theirs.
          description: item.item_type === 'service' ? '' : item.description ?? next[rowIndex].description,
          unit: item.unit || DEFAULT_UNIT,
          rate_cents: item.price_cents,
          amount_cents: Math.round((next[rowIndex].qty || 1) * item.price_cents),
        };
      }
      return next;
    });
  };

  const handleAddItemSaved = (item: ProCrmItem, action: 'close' | 'saveAndNew') => {
    setReusableItems((prev) => {
      const idx = prev.findIndex((existingItem) => existingItem.id === item.id);
      if (idx === -1) return [...prev, item];
      const next = [...prev];
      next[idx] = item;
      return next;
    });
    if (addItemPanelRowIndex !== null) applyItemToRow(item, addItemPanelRowIndex);
    setAddItemPanelRowIndex(null);
    if (action === 'close') setAddItemPanelOpen(false);
  };

  const submit = (action: (draft: InvoiceEditorDraft) => void) => {
    if (!customerId) {
      setValidationError('Select a customer');
      return;
    }
    setValidationError(null);
    action(currentDraft());
  };

  return (
    <div className={embedded || inline ? 'w-full' : DOCUMENT_FORM_LAYOUT.pageContainer}>
      {embedded || inline ? null : (
        <div className="py-2 md:py-0 md:mb-4 flex items-center justify-between gap-4">
          <Link href={backHref} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium">
            <ArrowLeft className="w-5 h-5 shrink-0" />
            Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
      )}

      {embedded || inline ? null : <InvoiceViewTabs view={view} onChange={setView} />}
      {!embedded && !inline && view !== 'edit' ? (
        <InvoiceViewPreview
          view={view}
          invoice={previewInvoice}
          customer={previewCustomer}
          business={previewBusiness}
          themeColor={themeColorHex}
          locale={locale}
        />
      ) : null}

      {/* Kept mounted while a view is open so nothing typed is lost. */}
      <div className={`${DOCUMENT_FORM_LAYOUT.shell} ${!embedded && view !== 'edit' ? 'hidden' : ''}`}>
        <div className={DOCUMENT_FORM_LAYOUT.sheet} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col">
            {sent ? (
              <div className="mx-4 mt-4 rounded-lg border-2 border-black bg-amber-50 p-3 text-sm text-gray-900">
                <p className="font-semibold">This invoice was already sent ({sent.status}).</p>
                <p className="mt-1 text-gray-700">
                  Your changes show right away on the customer&apos;s invoice link and PDF. Use Send invoice afterwards if
                  you want them to get a new email.
                  {sent.paidCents > 0
                    ? ` ${formatAmount(sent.paidCents)} is already paid, so the total can't go below that.`
                    : ''}
                </p>
              </div>
            ) : null}
            {shownError && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {shownError}
              </div>
            )}

            <div className={`${DOCUMENT_FORM_LAYOUT.contentPaddingX} pt-6`}>
              <DocumentBrandHeader
                title="INVOICE"
                themeColor={themeColorHex}
                business={displayBusiness}
                className="pb-6"
                nameAccessory={
                  <button
                    type="button"
                    onClick={() => setCompanyEditorOpen(true)}
                    className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                    aria-label="Edit company information"
                    title="Edit company information"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
                rightMeta={
                  <>
                    <p className="text-xs text-gray-500">Balance due</p>
                    <p className="font-bold text-black">{formatAmount(totalAmountCents)}</p>
                  </>
                }
              />
            </div>

            <div className={DOCUMENT_FORM_LAYOUT.tintBlock} style={{ backgroundColor: tintBg }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                    Bill to <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setPlaceId('');
                      setLineItems((current) => {
                        const kept = current.filter((line) => !line.expense_id);
                        return kept.length > 0 ? kept : [emptyInvoiceLine()];
                      });
                    }}
                    required
                    disabled={Boolean(embedded)}
                    className="w-full"
                  >
                    <option value="">Select customer</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ))}
                  </Select>
                  {embedded ? null : (
                    <HubCustomerImport
                      disabled={saving}
                      onImported={(customer) => {
                        setImportedCustomers((current) =>
                          current.some((row) => row.id === customer.id) ? current : [...current, customer]
                        );
                        setCustomerId(customer.id);
                        setPlaceId('');
                        setLineItems((current) => {
                        const kept = current.filter((line) => !line.expense_id);
                        return kept.length > 0 ? kept : [emptyInvoiceLine()];
                      });
                      }}
                    />
                  )}
                  <div className="mt-3">
                    <ContactPropertySelect
                      customerId={customerId}
                      value={placeId}
                      onChange={setPlaceId}
                      onLoaded={embedded?.onPropertiesLoaded}
                      disabled={saving}
                      variant="stacked"
                    />
                  </div>
                </div>
                <div className="border-t border-gray-300 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm items-center">
                    <span className="text-gray-600">Invoice no.</span>
                    <span className="font-semibold text-gray-900">{invoiceNumber}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <label className="text-gray-600 pt-1">Terms</label>
                    <Input
                      value={paymentTerms}
                      onChange={(e) => {
                        setPaymentTerms(e.target.value);
                        // Net 30 and the like set the due date, as in accounting apps.
                        const due = dueDateForTerms(invoiceDate, e.target.value);
                        if (due) setDueDate(due);
                      }}
                      placeholder="e.g. Due on receipt, Net 30"
                      className="py-1.5 text-sm"
                      list="invoice-payment-terms"
                    />
                    <datalist id="invoice-payment-terms">
                      {PAYMENT_TERM_OPTIONS.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <label className="text-gray-600 pt-1">Invoice date</label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => {
                        setInvoiceDate(e.target.value);
                        const due = dueDateForTerms(e.target.value, paymentTerms);
                        if (due) setDueDate(due);
                      }}
                      className="py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <label className="text-gray-600 pt-1">Due date</label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={DOCUMENT_FORM_LAYOUT.lineItemsSection}>
              <table className="w-full border-collapse" style={{ minWidth: DOCUMENT_LINE_QTY_RATE.tableMinWidth }}>
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-8">#</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-[17%] min-w-[120px]">Product or service</th>
                    {/* Description takes the room the narrower product column gives up. */}
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600">Description</th>
                    <th className={DOCUMENT_LINE_QTY_RATE.unitTh}>Unit</th>
                    <th className={DOCUMENT_LINE_QTY_RATE.qtyTh}>Qty</th>
                    <th className={DOCUMENT_LINE_QTY_RATE.rateTh}>Rate</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-24">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1 px-2 text-sm text-gray-600 align-top pt-2">{idx + 1}</td>
                      <td className="py-1 px-2 align-top">
                        <ProductOrServiceCombobox
                          value={line.product_or_service}
                          onChange={(val) => {
                            const next = [...lineItems];
                            next[idx] = { ...next[idx], product_or_service: val };
                            setLineItems(next);
                          }}
                          items={reusableItems}
                          onSelectItem={(item) => applyItemToRow(item, idx)}
                          onAddNew={() => {
                            setAddItemPanelRowIndex(idx);
                            setAddItemPanelOpen(true);
                          }}
                          placeholder="Product or service"
                        />
                      </td>
                      <td className="py-1 px-2 align-top">
                        <LineDescriptionInput
                          itemName={line.product_or_service}
                          value={line.description}
                          onChange={(text) => {
                            setLineItems((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], description: text };
                              return next;
                            });
                          }}
                          className="text-sm py-1.5 border-gray-300 min-w-[120px]"
                        />
                      </td>
                      <td className={DOCUMENT_LINE_QTY_RATE.unitTd}>
                        <div className={DOCUMENT_LINE_QTY_RATE.unitWrap}>
                          <UnitCombobox
                            value={line.unit || DEFAULT_UNIT}
                            onChange={(val) => {
                              const next = [...lineItems];
                              next[idx] = { ...next[idx], unit: val };
                              setLineItems(next);
                            }}
                            placeholder="Unit"
                            className={DOCUMENT_LINE_QTY_RATE.unitInput}
                          />
                        </div>
                      </td>
                      <td className={DOCUMENT_LINE_QTY_RATE.qtyTd}>
                        <div className={DOCUMENT_LINE_QTY_RATE.qtyWrap}>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={line.qty ?? ''}
                            onChange={(e) => {
                              const qty = parseFloat(e.target.value) || 0;
                              const next = [...lineItems];
                              next[idx] = { ...next[idx], qty, amount_cents: Math.round(qty * next[idx].rate_cents) };
                              setLineItems(next);
                            }}
                            className={DOCUMENT_LINE_QTY_RATE.qtyInput}
                          />
                        </div>
                      </td>
                      <td className={DOCUMENT_LINE_QTY_RATE.rateTd}>
                        <div className={DOCUMENT_LINE_QTY_RATE.rateWrap}>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={editingRateRowIndex === idx ? editingRateValue : line.rate_cents ? (line.rate_cents / 100).toFixed(2) : ''}
                            onFocus={() => {
                              setEditingRateRowIndex(idx);
                              setEditingRateValue(line.rate_cents ? (line.rate_cents / 100).toFixed(2) : '');
                            }}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setEditingRateValue(raw);
                              const rateCents = Math.round(parseFloat(raw || '0') * 100);
                              const next = [...lineItems];
                              next[idx] = {
                                ...next[idx],
                                rate_cents: rateCents,
                                amount_cents: Math.round(next[idx].qty * rateCents),
                              };
                              setLineItems(next);
                            }}
                            onBlur={() => {
                              setEditingRateRowIndex(null);
                              const raw = editingRateValue.trim();
                              const parsed = raw === '' ? 0 : parseFloat(raw);
                              if (!Number.isNaN(parsed)) {
                                const next = [...lineItems];
                                const rateCents = Math.round(parsed * 100);
                                next[idx] = {
                                  ...next[idx],
                                  rate_cents: rateCents,
                                  amount_cents: Math.round(next[idx].qty * rateCents),
                                };
                                setLineItems(next);
                              }
                            }}
                            className={DOCUMENT_LINE_QTY_RATE.rateInput}
                          />
                        </div>
                      </td>
                      <td className="py-1 px-2 align-top text-right text-sm text-gray-700 pt-2">
                        {formatAmount(line.amount_cents)}
                      </td>
                      <td className="py-1 px-2 align-top">
                        <button
                          type="button"
                          onClick={() => {
                            if (lineItems.length <= 1) return;
                            setLineItems(lineItems.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
                          aria-label="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button type="button" variant="secondary" size="sm" onClick={addLine} className="flex items-center whitespace-nowrap shrink-0">
                  <Plus className="w-4 h-4 mr-1 shrink-0" />
                  Add product or service
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddItemPanelRowIndex(null);
                    setAddItemPanelOpen(true);
                  }}
                  className="text-gray-600"
                >
                  Add reusable item
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearLines} className="text-gray-600">
                  Clear all lines
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <JobCostPicker
                customerId={customerId}
                invoiceId={invoiceId}
                lineItems={lineItems}
                onLineItemsChange={setLineItems}
              />
            </div>

            <div className={DOCUMENT_FORM_LAYOUT.totalsSection}>
              <div className="flex-1 mb-4 md:mb-0 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Note to customer (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Thank you for your business."
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:border-black"
                  />
                </div>
                <InvoiceAttachments
                  invoiceId={invoiceId}
                  saved={savedAttachments}
                  pending={pendingAttachments}
                  onPendingAdd={setPendingAttachments}
                  onPendingRemove={(id) => setPendingAttachments((current) => current.filter((item) => item.id !== id))}
                  onSavedRemove={onSavedAttachmentRemove}
                  allowAdd={true}
                />
              </div>
              <div className="w-full md:w-72 shrink-0">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatAmount(subtotalCents)}</span>
                  </div>
                  <DiscountField
                    kind={discountKind}
                    value={discountValue}
                    onChange={(kind, value) => {
                      setDiscountKind(kind);
                      setDiscountValue(value);
                    }}
                    discountCents={discountAmountCents}
                    formatAmount={formatAmount}
                    disabled={saving}
                  />
                  <div className="flex justify-between font-bold text-base pt-2 border-t-2 border-black mt-2">
                    <span>Total</span>
                    <span>{formatAmount(totalAmountCents)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`mb-3 flex flex-wrap items-center gap-3 ${sent && sent.paidCents > 0 ? 'hidden' : ''}`}>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} />
                Collected on site (cash / check / card terminal)
              </label>
              {paidNow && (
                <div className="w-40">
                  <Select value={paidNowMethod} onChange={(event) => setPaidNowMethod(event.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <div className={DOCUMENT_FORM_LAYOUT.actionBar}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => (embedded ? embedded.onCancel() : inline ? inline.onCancel() : router.push(backHref))}
                disabled={saving}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {embedded ? null : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => submit(onSaveAndClose)}
                    disabled={saving}
                    loading={saving}
                  >
                    Save and close
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => submit(onReviewAndSend)}
                  disabled={saving}
                  loading={saving}
                >
                  {embedded ? embedded.submitLabel : paidNow ? 'Save as paid' : sent ? 'Save changes' : 'Review and send'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <InvoiceCompanyEditor
        isOpen={companyEditorOpen}
        onClose={() => setCompanyEditorOpen(false)}
        initialValues={displayBusiness}
        onSave={(values) => setCompanyOverride(Object.keys(values).length > 0 ? values : null)}
        onResetToDefault={() => {
          setCompanyOverride(null);
          setCompanyEditorOpen(false);
        }}
      />

      <AddProductServicePanel
        isOpen={addItemPanelOpen}
        onClose={() => {
          setAddItemPanelOpen(false);
          setAddItemPanelRowIndex(null);
        }}
        onSaved={handleAddItemSaved}
        existingItems={reusableItems}
      />
    </div>
  );
}
