'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ProductOrServiceCombobox } from '@/components/invoices/ProductOrServiceCombobox';
import type { ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import { DOCUMENT_FORM_LAYOUT } from '@/lib/constants/documentFormLayout';
import { contactDisplayName } from '@/lib/crm/contact-name';

export interface EstimateLineItemFormValue {
  product_or_service?: string;
  description?: string;
  unit?: string;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

interface EstimateCustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name?: string | null;
}

interface EstimateDocumentFormProps {
  mode: 'create' | 'edit';
  estimateNumber?: string;
  customers: EstimateCustomerOption[];
  customerId: string;
  onCustomerIdChange: (value: string) => void;
  lineItems: EstimateLineItemFormValue[];
  onLineItemsChange: (items: EstimateLineItemFormValue[]) => void;
  validUntilDate: string;
  onValidUntilDateChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  saving: boolean;
  error: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  reusableItems: ProCrmItem[];
  onOpenAddReusableItem?: (rowIndex?: number) => void;
  /** Opens send-email flow; supported in create (saves draft first) and edit. */
  onReviewAndSend?: () => void;
  reviewSending?: boolean;
}

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined'] as const;

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function EstimateDocumentForm({
  mode,
  estimateNumber,
  customers,
  customerId,
  onCustomerIdChange,
  lineItems,
  onLineItemsChange,
  validUntilDate,
  onValidUntilDateChange,
  status,
  onStatusChange,
  note,
  onNoteChange,
  saving,
  error,
  onSubmit,
  onCancel,
  submitLabel,
  reusableItems,
  onOpenAddReusableItem,
  onReviewAndSend,
  reviewSending = false,
}: EstimateDocumentFormProps) {
  const [editingRateRowIndex, setEditingRateRowIndex] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');
  const [openRowMenuIndex, setOpenRowMenuIndex] = useState<number | null>(null);
  const [rowMenuPosition, setRowMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const rowMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const duplicateRowIndices = useMemo(() => {
    const keyToIndices = new Map<string, number[]>();
    lineItems.forEach((line, index) => {
      const key = JSON.stringify({
        product_or_service: (line.product_or_service ?? '').trim().toLowerCase(),
        description: (line.description ?? '').trim().toLowerCase(),
        unit: (line.unit ?? '').trim().toLowerCase(),
        qty: line.qty,
        rate_cents: line.rate_cents,
        amount_cents: line.amount_cents,
      });
      const existing = keyToIndices.get(key);
      if (existing) {
        existing.push(index);
      } else {
        keyToIndices.set(key, [index]);
      }
    });

    const duplicates = new Set<number>();
    keyToIndices.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((idx) => duplicates.add(idx));
      }
    });
    return duplicates;
  }, [lineItems]);
  const lineItemsPayload = lineItems
    .filter((line) => line.description || line.product_or_service || line.amount_cents > 0)
    .map((line) => ({
      amount_cents: line.amount_cents,
    }));
  const totalAmountCents = lineItemsPayload.reduce((sum, line) => sum + line.amount_cents, 0);

  const addLine = () => {
    onLineItemsChange([
      ...lineItems,
      { product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 },
    ]);
  };

  useEffect(() => {
    if (openRowMenuIndex === null) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rowMenuRef.current?.contains(target) &&
        !rowMenuButtonRef.current?.contains(target)
      ) {
        setOpenRowMenuIndex(null);
        setRowMenuPosition(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenRowMenuIndex(null);
        setRowMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openRowMenuIndex]);

  return (
    <div className={DOCUMENT_FORM_LAYOUT.shell}>
      <div className={`${DOCUMENT_FORM_LAYOUT.sheet} overflow-visible`} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <form onSubmit={onSubmit} className="flex flex-col">
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <header className={`${DOCUMENT_FORM_LAYOUT.header} border-black`}>
            <div className="md:col-span-2">
              <h2 className="text-2xl font-bold uppercase tracking-tight text-black">ESTIMATE</h2>
              <p className="text-sm text-gray-600 mt-1">
                {mode === 'create' ? 'Create estimate draft and send when ready.' : 'Update estimate details.'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-bold text-black">{formatAmount(totalAmountCents)}</p>
            </div>
          </header>

          <div className={`${DOCUMENT_FORM_LAYOUT.tintBlock} bg-gray-100`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-sm">
              <div className="space-y-3">
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">
                    Customer <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={customerId}
                    onChange={(e) => onCustomerIdChange(e.target.value)}
                    required
                    disabled={mode === 'edit'}
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {contactDisplayName(customer)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">Estimate number</label>
                  <Input
                    value={mode === 'create' ? 'Auto-generated on save' : (estimateNumber || '—')}
                    readOnly
                    tabIndex={-1}
                    className="bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">Status</label>
                  <Select value={status} onChange={(e) => onStatusChange(e.target.value)}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">Valid until</label>
                  <Input type="date" value={validUntilDate} onChange={(e) => onValidUntilDateChange(e.target.value)} />
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
                  <th className="text-right py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-24">Qty</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-32">Rate</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-24">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-1 px-2 text-sm text-gray-600 align-top pt-2">{index + 1}</td>
                    <td className="py-1 px-2 align-top">
                      <ProductOrServiceCombobox
                        value={line.product_or_service ?? ''}
                        onChange={(value) => {
                          const next = [...lineItems];
                          next[index] = { ...next[index], product_or_service: value };
                          onLineItemsChange(next);
                        }}
                        items={reusableItems}
                        onSelectItem={(item) => {
                          const next = [...lineItems];
                          next[index] = {
                            ...next[index],
                            product_or_service: item.name,
                            description: item.description ?? '',
                            unit: item.unit || DEFAULT_UNIT,
                            rate_cents: item.price_cents,
                            amount_cents: Math.round((next[index].qty || 1) * item.price_cents),
                          };
                          onLineItemsChange(next);
                        }}
                        onAddNew={() => onOpenAddReusableItem?.(index)}
                        placeholder="Product or service"
                        allowFreeText={true}
                        className={duplicateRowIndices.has(index) ? 'border-red-500 focus:border-red-500' : ''}
                      />
                    </td>
                    <td className="py-1 px-2 align-top">
                      <Input
                        placeholder="Description"
                        value={line.description ?? ''}
                        onChange={(e) => {
                          const next = [...lineItems];
                          next[index] = { ...next[index], description: e.target.value };
                          onLineItemsChange(next);
                        }}
                        className={`text-sm py-1.5 border-gray-300 min-w-[120px] ${
                          duplicateRowIndices.has(index) ? 'border-red-500 focus:border-red-500' : ''
                        }`}
                      />
                    </td>
                    <td className="py-1 px-2 align-top">
                      <Input
                        value={line.unit || DEFAULT_UNIT}
                        readOnly
                        tabIndex={-1}
                        className={`text-sm py-1.5 border-gray-300 min-w-[80px] w-28 bg-gray-50 text-gray-700 cursor-not-allowed ${
                          duplicateRowIndices.has(index) ? 'border-red-500' : ''
                        }`}
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
                          next[index] = { ...next[index], qty, amount_cents: Math.round(qty * next[index].rate_cents) };
                          onLineItemsChange(next);
                        }}
                        className={`text-sm py-1.5 w-20 text-right border-gray-300 ${
                          duplicateRowIndices.has(index) ? 'border-red-500 focus:border-red-500' : ''
                        }`}
                      />
                    </td>
                    <td className="py-1 px-2 align-top text-right">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingRateRowIndex === index ? editingRateValue : (line.rate_cents ? (line.rate_cents / 100).toFixed(2) : '')}
                        onFocus={() => {
                          setEditingRateRowIndex(index);
                          setEditingRateValue(line.rate_cents ? (line.rate_cents / 100).toFixed(2) : '');
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setEditingRateValue(raw);
                          const rateCents = Math.round(parseFloat(raw || '0') * 100);
                          const next = [...lineItems];
                          next[index] = { ...next[index], rate_cents: rateCents, amount_cents: Math.round(next[index].qty * rateCents) };
                          onLineItemsChange(next);
                        }}
                        onBlur={() => {
                          setEditingRateRowIndex(null);
                          const raw = editingRateValue.trim();
                          const parsed = raw === '' ? 0 : parseFloat(raw);
                          if (!Number.isNaN(parsed)) {
                            const next = [...lineItems];
                            const rateCents = Math.round(parsed * 100);
                            next[index] = { ...next[index], rate_cents: rateCents, amount_cents: Math.round(next[index].qty * rateCents) };
                            onLineItemsChange(next);
                          }
                        }}
                        className={`text-sm py-1.5 w-28 text-right border-gray-300 ${
                          duplicateRowIndices.has(index) ? 'border-red-500 focus:border-red-500' : ''
                        }`}
                      />
                    </td>
                    <td className="py-1 px-2 align-top text-right text-sm text-gray-700 pt-2">{formatAmount(line.amount_cents)}</td>
                    <td className="py-1 px-2 align-top">
                      <div className="relative">
                        <button
                          type="button"
                          ref={openRowMenuIndex === index ? rowMenuButtonRef : null}
                          onClick={(event) => {
                            if (openRowMenuIndex === index) {
                              setOpenRowMenuIndex(null);
                              setRowMenuPosition(null);
                              return;
                            }
                            const rect = event.currentTarget.getBoundingClientRect();
                            const menuWidth = 150;
                            setRowMenuPosition({
                              top: rect.bottom + 4,
                              left: Math.max(8, rect.right - menuWidth),
                            });
                            setOpenRowMenuIndex(index);
                          }}
                          className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
                          aria-label="Line actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
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
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenAddReusableItem?.()} className="text-gray-600">
                Add reusable item
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onLineItemsChange([{ product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 }])
                }
                className="text-gray-600"
              >
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
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder="Thank you for your business."
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:border-black"
                />
              </div>
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
            <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              {onReviewAndSend && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onReviewAndSend}
                  disabled={saving || reviewSending}
                >
                  {reviewSending ? 'Sending...' : 'Review & Send'}
                </Button>
              )}
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? 'Saving…' : submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {openRowMenuIndex !== null && rowMenuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={rowMenuRef}
            className="fixed z-[210] min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            style={{ top: rowMenuPosition.top, left: rowMenuPosition.left }}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                const currentLine = lineItems[openRowMenuIndex];
                if (!currentLine) {
                  setOpenRowMenuIndex(null);
                  setRowMenuPosition(null);
                  return;
                }
                const next = [...lineItems];
                next.splice(openRowMenuIndex + 1, 0, { ...currentLine });
                onLineItemsChange(next);
                setOpenRowMenuIndex(null);
                setRowMenuPosition(null);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
              onClick={() => {
                if (lineItems.length <= 1 || openRowMenuIndex < 0 || openRowMenuIndex >= lineItems.length) {
                  setOpenRowMenuIndex(null);
                  setRowMenuPosition(null);
                  return;
                }
                onLineItemsChange(lineItems.filter((_, idx) => idx !== openRowMenuIndex));
                setOpenRowMenuIndex(null);
                setRowMenuPosition(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
