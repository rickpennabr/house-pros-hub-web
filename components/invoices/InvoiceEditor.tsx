'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InvoiceCompanyEditor } from '@/components/invoices/InvoiceCompanyEditor';
import {
  InvoiceAttachments,
  type PendingAttachment,
  type SavedAttachment,
} from '@/components/invoices/InvoiceAttachments';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import { ProductOrServiceCombobox } from '@/components/invoices/ProductOrServiceCombobox';
import { UnitCombobox } from '@/components/invoices/UnitCombobox';
import type { CompanyDisplayOverride } from '@/lib/invoices/companyDisplay';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import { DOCUMENT_FORM_LAYOUT } from '@/lib/constants/documentFormLayout';
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
}

function customerLabel(customer: InvoiceCustomerOption): string {
  return (
    customer.display_name?.trim() ||
    customer.company_name?.trim() ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
    'Customer'
  );
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
}: InvoiceEditorProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialDraft.customerId);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(initialDraft.lineItems);
  const [invoiceDate, setInvoiceDate] = useState(initialDraft.invoiceDate);
  const [dueDate, setDueDate] = useState(initialDraft.dueDate);
  const [paymentTerms, setPaymentTerms] = useState(initialDraft.paymentTerms);
  const [note, setNote] = useState(initialDraft.note);
  const [companyOverride, setCompanyOverride] = useState<CompanyDisplayOverride | null>(initialDraft.companyOverride);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>(initialDraft.pendingAttachments);
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
  const totalAmountCents = invoiceTotalCents(invoiceLineItemsPayload(lineItems));
  const shownError = validationError || error;

  const currentDraft = (): InvoiceEditorDraft => ({
    customerId,
    lineItems,
    invoiceDate,
    dueDate,
    paymentTerms,
    note,
    companyOverride,
    pendingAttachments,
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
          description: item.description ?? next[rowIndex].description,
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
    <div className={DOCUMENT_FORM_LAYOUT.pageContainer}>
      <div className="py-2 md:py-0 md:mb-4 flex items-center justify-between gap-4">
        <Link href={backHref} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium">
          <ArrowLeft className="w-5 h-5 shrink-0" />
          Back
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      <div className={DOCUMENT_FORM_LAYOUT.shell}>
        <div className={DOCUMENT_FORM_LAYOUT.sheet} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col">
            {shownError && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {shownError}
              </div>
            )}

            <header className={`${DOCUMENT_FORM_LAYOUT.header} border-b-2`} style={{ borderColor: themeColorHex }}>
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: themeColorHex }}>
                  INVOICE
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-semibold text-black">{displayBusiness.business_name}</p>
                  <button
                    type="button"
                    onClick={() => setCompanyEditorOpen(true)}
                    className="p-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
                    aria-label="Edit company information"
                    title="Edit company information"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                {displayBusiness.address && (
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{displayBusiness.address}</p>
                )}
              </div>
              <div className="flex flex-col justify-center text-sm text-gray-700">
                {displayBusiness.email && <span>{displayBusiness.email}</span>}
                {displayBusiness.phone && <span>{displayBusiness.phone}</span>}
                {displayBusiness.website && (
                  <a
                    href={displayBusiness.website.startsWith('http') ? displayBusiness.website : `https://${displayBusiness.website}`}
                    className="text-gray-700 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {displayBusiness.website}
                  </a>
                )}
              </div>
              <div className="flex items-start gap-3 justify-end">
                {displayBusiness.business_logo && (
                  <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden shrink-0 border-2 border-gray-200">
                    <Image src={displayBusiness.business_logo} alt="" fill className="object-cover" sizes="64px" />
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500">Balance due</p>
                  <p className="font-bold text-black">{formatAmount(totalAmountCents)}</p>
                </div>
              </div>
            </header>

            <div className={DOCUMENT_FORM_LAYOUT.tintBlock} style={{ backgroundColor: tintBg }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                    Bill to <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    className="w-full"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ))}
                  </Select>
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
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g. Due on receipt, Net 30"
                      className="py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <label className="text-gray-600 pt-1">Invoice date</label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
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
              <table className="w-full border-collapse" style={{ minWidth: 520 }}>
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-8">#</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600">Product or service</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600">Description</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-20">Unit</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-16">Qty</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-24">Rate</th>
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
                        <Input
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => {
                            const next = [...lineItems];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setLineItems(next);
                          }}
                          className="text-sm py-1.5 border-gray-300 min-w-[120px]"
                        />
                      </td>
                      <td className="py-1 px-2 align-top">
                        <UnitCombobox
                          value={line.unit || DEFAULT_UNIT}
                          onChange={(val) => {
                            const next = [...lineItems];
                            next[idx] = { ...next[idx], unit: val };
                            setLineItems(next);
                          }}
                          placeholder="Unit"
                        />
                      </td>
                      <td className="py-1 px-2 align-top text-right">
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
                          className="text-sm py-1.5 w-14 text-right border-gray-300"
                        />
                      </td>
                      <td className="py-1 px-2 align-top text-right">
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
                          className="text-sm py-1.5 w-20 text-right border-gray-300"
                        />
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
              <div className="w-full md:w-56 shrink-0">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatAmount(totalAmountCents)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t-2 border-black mt-2">
                    <span>Total</span>
                    <span>{formatAmount(totalAmountCents)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={DOCUMENT_FORM_LAYOUT.actionBar}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => router.push(backHref)}
                disabled={saving}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => submit(onReviewAndSend)}
                  disabled={saving}
                  loading={saving}
                >
                  Review and send
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
