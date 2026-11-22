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
import { DOCUMENT_FORM_LAYOUT, DOCUMENT_LINE_QTY_RATE } from '@/lib/constants/documentFormLayout';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { HubCustomerImport } from '@/components/crm/HubCustomerImport';
import { ContactPropertySelect } from '@/components/crm/ContactPropertySelect';
import type { ContactProperty } from '@/lib/places/contact-places';
import { allowedEstimateStatuses, ESTIMATE_STATUS_LABELS } from '@/lib/schemas/crmEstimate';
import { DiscountField } from '@/components/documents/DiscountField';
import { discountCents as discountCentsFor, discountFromForm, type DiscountKind } from '@/lib/crm/document-discount';
import {
  DocumentBrandHeader,
  type DocumentBrandBusiness,
} from '@/components/documents/DocumentBrandHeader';
import {
  AGREEMENT_KINDS,
  AGREEMENT_KIND_LABELS,
  MAINTENANCE_FREQUENCIES,
  MAINTENANCE_FREQUENCY_LABELS,
  type AgreementKind,
  type MaintenanceFrequency,
} from '@/lib/crm/estimate-agreement';

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
  /** The customer's house this estimate is for (My Places). Empty: the contact's default house. */
  placeId?: string;
  onPlaceIdChange?: (value: string) => void;
  /** Pick the house once the contact's houses load (the chat picks the house shared there). */
  onPropertiesLoaded?: (properties: ContactProperty[]) => string | void;
  /** The customer is fixed (the chat): no customer switch and no hub import. */
  lockCustomer?: boolean;
  lineItems: EstimateLineItemFormValue[];
  onLineItemsChange: (items: EstimateLineItemFormValue[]) => void;
  validUntilDate: string;
  onValidUntilDateChange: (value: string) => void;
  status: string;
  /** Status as saved on the server. Null for a new estimate. The menu offers only moves the server allows. */
  savedStatus?: string | null;
  onStatusChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  deposit: string;
  onDepositChange: (value: string) => void;
  /** Area of the property (Pavers, Landscape, …). Same My Place can hold many areas/pros. */
  jobArea: string;
  onJobAreaChange: (value: string) => void;
  agreementKind: AgreementKind;
  onAgreementKindChange: (value: AgreementKind) => void;
  maintenanceFrequency: MaintenanceFrequency | '';
  onMaintenanceFrequencyChange: (value: MaintenanceFrequency | '') => void;
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
  /** Opens the customer view fullscreen on this device (phone/tablet handoff). */
  onPresentOnDevice?: () => void;
  presentLoading?: boolean;
  /** QuickBooks-style discount under Subtotal. Hidden when onDiscountChange is not passed. */
  discountKind?: DiscountKind;
  discountValue?: string;
  onDiscountChange?: (kind: DiscountKind, value: string) => void;
  /** Saves the estimate as approved and opens the invoice step. Shown in edit mode. */
  onConvertToInvoice?: () => void;
  convertLoading?: boolean;
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function nevadaDepositWarning(deposit: string, totalCents: number): boolean {
  const dollars = Number(deposit);
  if (!Number.isFinite(dollars) || dollars <= 0 || totalCents <= 0) return false;
  const depositCents = Math.round(dollars * 100);
  const cap = Math.min(100_000, Math.round(totalCents * 0.1));
  return depositCents > cap;
}

export function EstimateDocumentForm({
  mode,
  estimateNumber,
  customers,
  customerId,
  onCustomerIdChange,
  placeId = '',
  onPlaceIdChange,
  onPropertiesLoaded,
  lockCustomer = false,
  lineItems,
  onLineItemsChange,
  validUntilDate,
  onValidUntilDateChange,
  status,
  savedStatus = null,
  onStatusChange,
  note,
  onNoteChange,
  deposit,
  onDepositChange,
  jobArea,
  onJobAreaChange,
  agreementKind,
  onAgreementKindChange,
  maintenanceFrequency,
  onMaintenanceFrequencyChange,
  saving,
  error,
  onSubmit,
  onCancel,
  submitLabel,
  reusableItems,
  onOpenAddReusableItem,
  onReviewAndSend,
  reviewSending = false,
  onPresentOnDevice,
  presentLoading = false,
  discountKind = 'percent',
  discountValue = '',
  onDiscountChange,
  onConvertToInvoice,
  convertLoading = false,
}: EstimateDocumentFormProps) {
  const [editingRateRowIndex, setEditingRateRowIndex] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');
  const [importedCustomers, setImportedCustomers] = useState<EstimateCustomerOption[]>([]);
  const [brandBusiness, setBrandBusiness] = useState<DocumentBrandBusiness | null>(null);
  const [openRowMenuIndex, setOpenRowMenuIndex] = useState<number | null>(null);
  const [rowMenuPosition, setRowMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const rowMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/businesses/list', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const first = Array.isArray(data.businesses) ? data.businesses[0] : null;
        if (!first || typeof first !== 'object') return;
        const row = first as Record<string, unknown>;
        const website =
          typeof row.website === 'string'
            ? row.website
            : Array.isArray(row.links)
              ? String(
                  (row.links as Array<{ url?: string }>).find((link) => typeof link?.url === 'string')?.url ??
                    ''
                ) || null
              : null;
        const addressParts = [row.streetAddress, row.city, row.state, row.zipCode]
          .map((part) => (typeof part === 'string' ? part.trim() : ''))
          .filter(Boolean);
        setBrandBusiness({
          business_name:
            typeof row.businessName === 'string' && row.businessName.trim()
              ? row.businessName
              : 'Business',
          business_logo: typeof row.businessLogo === 'string' ? row.businessLogo : null,
          email: typeof row.email === 'string' ? row.email : null,
          phone: typeof row.phone === 'string' ? row.phone : null,
          website,
          address: addressParts.length > 0 ? addressParts.join(', ') : null,
        });
      })
      .catch(() => {
        /* keep letterhead without brand if load fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const customerOptions = useMemo(() => {
    const seen = new Set(customers.map((customer) => customer.id));
    return [...customers, ...importedCustomers.filter((customer) => !seen.has(customer.id))];
  }, [customers, importedCustomers]);
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
  const subtotalCents = lineItemsPayload.reduce((sum, line) => sum + line.amount_cents, 0);
  const discountAmountCents = onDiscountChange ? discountCentsFor(subtotalCents, discountFromForm(discountKind, discountValue)) : 0;
  const totalAmountCents = subtotalCents - discountAmountCents;

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

          <div className={`${DOCUMENT_FORM_LAYOUT.contentPaddingX} pt-6`}>
            <DocumentBrandHeader
              title={
                agreementKind === 'maintenance'
                  ? 'MAINTENANCE AGREEMENT'
                  : agreementKind === 'repair'
                    ? 'REPAIR ESTIMATE'
                    : agreementKind === 'renovation' ||
                        agreementKind === 'remodel' ||
                        agreementKind === 'addition'
                      ? 'PROJECT ESTIMATE'
                      : 'ESTIMATE'
              }
              business={brandBusiness}
              subtitle={
                mode === 'create' ? 'Create estimate draft and send when ready.' : 'Update estimate details.'
              }
              className="pb-6"
              rightMeta={
                <>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="font-bold text-black">{formatAmount(totalAmountCents)}</p>
                </>
              }
            />
          </div>

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
                    disabled={mode === 'edit' || lockCustomer}
                  >
                    <option value="">Select customer</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {contactDisplayName(customer)}
                      </option>
                    ))}
                  </Select>
                </div>
                {onPlaceIdChange ? (
                  <ContactPropertySelect
                    customerId={customerId}
                    value={placeId}
                    onChange={onPlaceIdChange}
                    onLoaded={onPropertiesLoaded}
                    disabled={saving}
                  />
                ) : null}
                {mode === 'create' && !lockCustomer ? (
                  <div>
                    <HubCustomerImport
                      disabled={saving}
                      onImported={(customer) => {
                        setImportedCustomers((current) =>
                          current.some((row) => row.id === customer.id) ? current : [...current, customer]
                        );
                        onCustomerIdChange(customer.id);
                      }}
                    />
                  </div>
                ) : null}
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
                    {allowedEstimateStatuses(savedStatus).map((option) => (
                      <option key={option} value={option}>
                        {ESTIMATE_STATUS_LABELS[option] ?? option}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">Valid until</label>
                  <Input type="date" value={validUntilDate} onChange={(e) => onValidUntilDateChange(e.target.value)} />
                </div>
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">Job area</label>
                  <Input
                    value={jobArea}
                    onChange={(e) => onJobAreaChange(e.target.value)}
                    placeholder="Pavers, Landscape, Kitchen…"
                    maxLength={80}
                  />
                </div>
                <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                  <label className="text-gray-600">Agreement</label>
                  <Select
                    value={agreementKind}
                    onChange={(e) => {
                      const next = e.target.value as AgreementKind;
                      onAgreementKindChange(next);
                      if (next !== 'maintenance') onMaintenanceFrequencyChange('');
                    }}
                  >
                    {AGREEMENT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {AGREEMENT_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </Select>
                </div>
                {agreementKind === 'maintenance' ? (
                  <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                    <label className="text-gray-600">Visit schedule</label>
                    <Select
                      value={maintenanceFrequency}
                      onChange={(e) =>
                        onMaintenanceFrequencyChange((e.target.value || '') as MaintenanceFrequency | '')
                      }
                    >
                      <option value="">Select schedule</option>
                      {MAINTENANCE_FREQUENCIES.map((frequency) => (
                        <option key={frequency} value={frequency}>
                          {MAINTENANCE_FREQUENCY_LABELS[frequency]}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={DOCUMENT_FORM_LAYOUT.lineItemsSection}>
            <table className="w-full border-collapse" style={{ minWidth: DOCUMENT_LINE_QTY_RATE.tableMinWidth }}>
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600 w-8">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600">Product or service</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold uppercase text-gray-600">Description</th>
                  <th className={DOCUMENT_LINE_QTY_RATE.unitTh}>Unit</th>
                  <th className={DOCUMENT_LINE_QTY_RATE.qtyTh}>Qty</th>
                  <th className={DOCUMENT_LINE_QTY_RATE.rateTh}>Rate</th>
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
                    <td className={DOCUMENT_LINE_QTY_RATE.unitTd}>
                      <div className={DOCUMENT_LINE_QTY_RATE.unitWrap}>
                        <Input
                          value={line.unit || DEFAULT_UNIT}
                          readOnly
                          tabIndex={-1}
                          className={`${DOCUMENT_LINE_QTY_RATE.unitInput} bg-gray-50 text-gray-700 cursor-not-allowed ${
                            duplicateRowIndices.has(index) ? 'border-red-500' : ''
                          }`}
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
                            next[index] = { ...next[index], qty, amount_cents: Math.round(qty * next[index].rate_cents) };
                            onLineItemsChange(next);
                          }}
                          className={`${DOCUMENT_LINE_QTY_RATE.qtyInput} ${
                            duplicateRowIndices.has(index) ? 'border-red-500 focus:border-red-500' : ''
                          }`}
                        />
                      </div>
                    </td>
                    <td className={DOCUMENT_LINE_QTY_RATE.rateTd}>
                      <div className={DOCUMENT_LINE_QTY_RATE.rateWrap}>
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
                          className={`${DOCUMENT_LINE_QTY_RATE.rateInput} ${
                            duplicateRowIndices.has(index) ? 'border-red-500 focus:border-red-500' : ''
                          }`}
                        />
                      </div>
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
                  <span>{formatAmount(subtotalCents)}</span>
                </div>
                {onDiscountChange ? (
                  <DiscountField
                    kind={discountKind}
                    value={discountValue}
                    onChange={onDiscountChange}
                    discountCents={discountAmountCents}
                    formatAmount={formatAmount}
                    disabled={saving}
                  />
                ) : null}
                <div className="flex justify-between font-bold text-base pt-2 border-t-2 border-black mt-2">
                  <span>Total</span>
                  <span>{formatAmount(totalAmountCents)}</span>
                </div>
                <label className="flex items-center justify-between gap-2 pt-3">
                  <span className="text-gray-600">Deposit</span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDepositChange((Math.round(totalAmountCents / 2) / 100).toFixed(2))}
                      className="rounded-lg border-2 border-black px-2 py-1 text-xs font-medium"
                    >
                      50%
                    </button>
                    <input
                      value={deposit}
                      onChange={(event) => onDepositChange(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label="Deposit due when the customer approves"
                      className="w-24 rounded-lg border-2 border-black px-2 py-1 text-right text-sm"
                    />
                  </span>
                </label>
                <p className="text-xs text-gray-500">
                  Due when the customer approves. A 50% deposit covers materials, delivery, and labor to start. The rest is billed when the job is done, or in stages on a larger job.
                </p>
                {nevadaDepositWarning(deposit, totalAmountCents) ? (
                  <p className="text-xs text-amber-800">
                    Nevada residential jobs usually limit the first deposit to the lesser of $1,000 or 10% unless you have the $100,000 consumer-protection bond or Board bond relief.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={DOCUMENT_FORM_LAYOUT.actionBar}>
            <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {onPresentOnDevice ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onPresentOnDevice}
                  disabled={saving || presentLoading}
                >
                  {presentLoading ? 'Opening…' : 'Present on device'}
                </Button>
              ) : null}
              {onConvertToInvoice ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onConvertToInvoice}
                  disabled={saving || convertLoading}
                  title={savedStatus === 'accepted' ? undefined : 'Saves this estimate as approved, then creates the invoice'}
                >
                  {convertLoading ? 'Converting…' : 'Convert to invoice'}
                </Button>
              ) : null}
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
