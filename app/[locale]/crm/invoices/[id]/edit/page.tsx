'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
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

interface LineItem {
  product_or_service: string;
  description: string;
  unit: string;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

interface BusinessShape {
  id: string;
  business_name: string;
  business_logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_tagline?: string | null;
  website?: string;
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CRMEditInvoicePage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const id = params?.id as string | undefined;

  const [themeColorHex, setThemeColorHex] = useState('#000000');
  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string; display_name?: string | null; company_name?: string | null }[]>([]);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formLineItems, setFormLineItems] = useState<LineItem[]>([
    { product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 },
  ]);
  const [reusableItems, setReusableItems] = useState<ProCrmItem[]>([]);
  const [addItemPanelOpen, setAddItemPanelOpen] = useState(false);
  const [addItemPanelRowIndex, setAddItemPanelRowIndex] = useState<number | null>(null);
  const [formInvoiceDate, setFormInvoiceDate] = useState(todayISO());
  const [formDueDate, setFormDueDate] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('Due on receipt');
  const [formNote, setFormNote] = useState('');
  const [companyOverride, setCompanyOverride] = useState<CompanyDisplayOverride | null>(null);
  const [business, setBusiness] = useState<BusinessShape | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [savedAttachments, setSavedAttachments] = useState<SavedAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRateRowIndex, setEditingRateRowIndex] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/crm/invoices/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/crm/customers?pageSize=500', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/crm/items', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([inv, cust, itemsRes]) => {
        if (inv.error) throw new Error(inv.error);
        if (itemsRes.items) setReusableItems(itemsRes.items);
        if (inv.status !== 'draft') {
          router.replace(`/${locale}/crm/invoices/${id}`);
          return;
        }
        setThemeColorHex(inv.themeColorHex ?? '#000000');
        setInvoiceNumber(inv.invoiceNumber ?? '');
        setFormCustomerId(inv.customerId ?? '');
        setFormInvoiceDate(inv.invoiceDate ?? todayISO());
        setFormDueDate(inv.dueDate ?? '');
        setFormPaymentTerms(inv.paymentTerms ?? 'Due on receipt');
        setFormNote(inv.note ?? '');
        setCompanyOverride(inv.companyDisplay ?? null);
        setSavedAttachments(
          (inv.attachments ?? []).map((a: { id: string; fileName: string; url: string; fileSizeBytes: number; contentType: string }) => ({
            id: a.id,
            fileName: a.fileName,
            url: a.url,
            fileSizeBytes: a.fileSizeBytes,
            contentType: a.contentType,
          }))
        );
        const items = inv.lineItems;
        if (Array.isArray(items) && items.length > 0) {
          setFormLineItems(
            items.map((l: { product_or_service?: string; description?: string; unit?: string; qty?: number; rate_cents?: number; amount_cents?: number }) => ({
              product_or_service: l.product_or_service ?? '',
              description: l.description ?? '',
              unit: l.unit ?? DEFAULT_UNIT,
              qty: l.qty ?? 1,
              rate_cents: l.rate_cents ?? 0,
              amount_cents: l.amount_cents ?? 0,
            }))
          );
        }
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
          setBusiness({ id: '', business_name: 'My Business', business_logo: null, email: null, phone: null, address: null, company_tagline: null, website: undefined });
        }
        setCustomers(cust.customers ?? []);
      })
      .catch(() => setError('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id, locale, router]);

  const lineItemsPayload = formLineItems
    .filter((line) => line.description || line.product_or_service || line.amount_cents > 0)
    .map((line) => ({
      product_or_service: line.product_or_service || null,
      description: line.description || null,
      unit: line.unit || null,
      qty: line.qty,
      rate_cents: line.rate_cents,
      amount_cents: line.amount_cents,
    }));
  const totalAmountCents = lineItemsPayload.length > 0 ? lineItemsPayload.reduce((sum, l) => sum + l.amount_cents, 0) : 0;

  const patchInvoice = async () => {
    const res = await fetch(`/api/crm/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        customerId: formCustomerId,
        amountCents: totalAmountCents,
        lineItems: lineItemsPayload.length > 0 ? lineItemsPayload : null,
        invoiceDate: formInvoiceDate || todayISO(),
        dueDate: formDueDate || null,
        paymentTerms: formPaymentTerms.trim() || null,
        note: formNote.trim() || null,
        companyDisplay: companyOverride ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update invoice');
  };

  const handleSaveAndClose = async () => {
    setError(null);
    if (!formCustomerId) {
      setError('Select a customer');
      return;
    }
    setSaving(true);
    try {
      await patchInvoice();
      for (const p of pendingAttachments) {
        const form = new FormData();
        form.append('file', p.file);
        const up = await fetch(`/api/crm/invoices/${id}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!up.ok) throw new Error('Failed to upload attachment');
      }
      setPendingAttachments([]);
      router.push(`/${locale}/crm/invoices`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAndSend = async () => {
    setError(null);
    if (!formCustomerId) {
      setError('Select a customer');
      return;
    }
    setSaving(true);
    try {
      await patchInvoice();
      for (const p of pendingAttachments) {
        const form = new FormData();
        form.append('file', p.file);
        const up = await fetch(`/api/crm/invoices/${id}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!up.ok) throw new Error('Failed to upload attachment');
      }
      setPendingAttachments([]);
      router.push(`/${locale}/crm/invoices/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNew = async () => {
    setError(null);
    if (!formCustomerId) {
      setError('Select a customer');
      return;
    }
    setSaving(true);
    try {
      await patchInvoice();
      for (const p of pendingAttachments) {
        const form = new FormData();
        form.append('file', p.file);
        const up = await fetch(`/api/crm/invoices/${id}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!up.ok) throw new Error('Failed to upload attachment');
      }
      setPendingAttachments([]);
      router.push(`/${locale}/crm/invoices/new`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    setError(null);
    if (!formCustomerId) {
      setError('Select a customer');
      return;
    }
    setSaving(true);
    try {
      await patchInvoice();
      for (const p of pendingAttachments) {
        const form = new FormData();
        form.append('file', p.file);
        const up = await fetch(`/api/crm/invoices/${id}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!up.ok) throw new Error('Failed to upload attachment');
      }
      setPendingAttachments([]);
      router.push(`/${locale}/crm/invoices/${id}?send=1`);
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
      setSavedAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError('Failed to remove attachment');
    }
  };

  const addLine = () => {
    setEditingRateRowIndex(null);
    setFormLineItems([
      ...formLineItems,
      { product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 },
    ]);
  };

  const clearLines = () => {
    setEditingRateRowIndex(null);
    setFormLineItems([{ product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 }]);
  };

  const applyItemToRow = (item: ProCrmItem, rowIndex: number) => {
    setEditingRateRowIndex(null);
    setFormLineItems((prev) => {
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

  if (!id) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Invoice ID missing.</p>
        <Link href={`/${locale}/crm/invoices`} className="text-black underline mt-2 inline-block">Back to Invoices</Link>
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
        <Link href={`/${locale}/crm/invoices`} className="text-black underline mt-2 inline-block">Back to Invoices</Link>
      </div>
    );
  }

  if (!business) {
    return (
      <div className={`${DOCUMENT_FORM_LAYOUT.pageContainer} py-12 text-center text-gray-500 text-sm`}>
        Loading…
      </div>
    );
  }

  const displayBusiness: BusinessShape = companyOverride
    ? { ...business, ...companyOverride }
    : business;
  const tintBg = themeColorHex && themeColorHex !== '#000000' ? `${themeColorHex}14` : 'rgba(0,0,0,0.06)';

  return (
    <div className={DOCUMENT_FORM_LAYOUT.pageContainer}>
      <div className="py-2 md:py-0 md:mb-4 flex items-center justify-between gap-4">
        <Link href={`/${locale}/crm/invoices/${id}`} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium">
          <ArrowLeft className="w-5 h-5 shrink-0" />
          Back
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Edit Invoice {invoiceNumber}</h1>
      </div>

      <div className={DOCUMENT_FORM_LAYOUT.shell}>
        <div className={DOCUMENT_FORM_LAYOUT.sheet} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col">
            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <header
              className={`${DOCUMENT_FORM_LAYOUT.header} border-b-2`}
              style={{ borderColor: themeColorHex }}
            >
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
                    <Image
                      src={displayBusiness.business_logo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500">Balance due</p>
                  <p className="font-bold text-black">{formatAmount(totalAmountCents)}</p>
                </div>
              </div>
            </header>

            <div
              className={DOCUMENT_FORM_LAYOUT.tintBlock}
              style={{ backgroundColor: tintBg }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                    Bill to <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    required
                    className="w-full"
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name?.trim() || c.company_name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'}
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
                      value={formPaymentTerms}
                      onChange={(e) => setFormPaymentTerms(e.target.value)}
                      placeholder="e.g. Due on receipt, Net 30"
                      className="py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <label className="text-gray-600 pt-1">Invoice date</label>
                    <Input
                      type="date"
                      value={formInvoiceDate}
                      onChange={(e) => setFormInvoiceDate(e.target.value)}
                      className="py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <label className="text-gray-600 pt-1">Due date</label>
                    <Input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
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
                  {formLineItems.map((line, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1 px-2 text-sm text-gray-600 align-top pt-2">{idx + 1}</td>
                      <td className="py-1 px-2 align-top">
                        <ProductOrServiceCombobox
                          value={line.product_or_service}
                          onChange={(val) => {
                            const next = [...formLineItems];
                            next[idx] = { ...next[idx], product_or_service: val };
                            setFormLineItems(next);
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
                            const next = [...formLineItems];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setFormLineItems(next);
                          }}
                          className="text-sm py-1.5 border-gray-300 min-w-[120px]"
                        />
                      </td>
                      <td className="py-1 px-2 align-top">
                        <UnitCombobox
                          value={line.unit || DEFAULT_UNIT}
                          onChange={(val) => {
                            const next = [...formLineItems];
                            next[idx] = { ...next[idx], unit: val };
                            setFormLineItems(next);
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
                            const next = [...formLineItems];
                            next[idx] = { ...next[idx], qty, amount_cents: Math.round(qty * next[idx].rate_cents) };
                            setFormLineItems(next);
                          }}
                          className="text-sm py-1.5 w-14 text-right border-gray-300"
                        />
                      </td>
                      <td className="py-1 px-2 align-top text-right">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editingRateRowIndex === idx ? editingRateValue : (line.rate_cents ? (line.rate_cents / 100).toFixed(2) : '')}
                          onFocus={() => {
                            setEditingRateRowIndex(idx);
                            setEditingRateValue(line.rate_cents ? (line.rate_cents / 100).toFixed(2) : '');
                          }}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setEditingRateValue(raw);
                            const rateCents = Math.round(parseFloat(raw || '0') * 100);
                            const next = [...formLineItems];
                            next[idx] = { ...next[idx], rate_cents: rateCents, amount_cents: Math.round(next[idx].qty * rateCents) };
                            setFormLineItems(next);
                          }}
                          onBlur={() => {
                            setEditingRateRowIndex(null);
                            const raw = editingRateValue.trim();
                            const parsed = raw === '' ? 0 : parseFloat(raw);
                            if (!Number.isNaN(parsed)) {
                              const next = [...formLineItems];
                              const rateCents = Math.round(parsed * 100);
                              next[idx] = { ...next[idx], rate_cents: rateCents, amount_cents: Math.round(next[idx].qty * rateCents) };
                              setFormLineItems(next);
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
                            if (formLineItems.length <= 1) return;
                            setFormLineItems(formLineItems.filter((_, i) => i !== idx));
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
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddItemPanelRowIndex(null); setAddItemPanelOpen(true); }} className="text-gray-600">
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
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="Thank you for your business."
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:border-black"
                  />
                </div>
                <InvoiceAttachments
                  invoiceId={id}
                  saved={savedAttachments}
                  pending={pendingAttachments}
                  onPendingAdd={setPendingAttachments}
                  onPendingRemove={(rid) => setPendingAttachments((p) => p.filter((x) => x.id !== rid))}
                  onSavedRemove={handleRemoveAttachment}
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
                onClick={() => router.push(`/${locale}/crm/invoices/${id}`)}
                disabled={saving}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveAndClose}
                  disabled={saving}
                  loading={saving}
                >
                  Save and close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleReviewAndSend}
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
        onClose={() => { setAddItemPanelOpen(false); setAddItemPanelRowIndex(null); }}
        onSaved={handleAddItemSaved}
        existingItems={reusableItems}
      />
    </div>
  );
}
