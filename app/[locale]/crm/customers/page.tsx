'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ChevronDown, Search, Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle, User, MapPin, FileText, CreditCard } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import Modal from '@/components/ui/Modal';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { validateCustomerEmail, validateCustomerPhone } from '@/lib/schemas/crm';
import type { Database } from '@/lib/types/supabase';

type CRMCustomerRow = Database['public']['Tables']['pro_crm_customers']['Row'];

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Joined' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'last_name', label: 'Last name' },
  { value: 'first_name', label: 'First name' },
  { value: 'company_name', label: 'Company' },
  { value: 'display_name', label: 'Display name' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

/** All pro_crm_customers columns for table display (order matches schema). */
const CUSTOMER_TABLE_COLUMNS: { key: keyof CRMCustomerRow; label: string; sortKey?: SortKey }[] = [
  { key: 'first_name', label: 'First name', sortKey: 'first_name' },
  { key: 'last_name', label: 'Last name', sortKey: 'last_name' },
  { key: 'company_name', label: 'Company', sortKey: 'company_name' },
  { key: 'display_name', label: 'Display name', sortKey: 'display_name' },
  { key: 'email', label: 'Email', sortKey: 'email' },
  { key: 'phone', label: 'Phone', sortKey: 'phone' },
  { key: 'mobile_number', label: 'Mobile' },
  { key: 'website', label: 'Website' },
  { key: 'street_address', label: 'Street' },
  { key: 'apartment', label: 'Apt/Unit' },
  { key: 'city', label: 'City', sortKey: 'city' },
  { key: 'state', label: 'State', sortKey: 'state' },
  { key: 'zip_code', label: 'ZIP' },
  { key: 'billing_address_street_1', label: 'Bill street 1' },
  { key: 'billing_address_street_2', label: 'Bill street 2' },
  { key: 'billing_address_city', label: 'Bill city' },
  { key: 'billing_address_state', label: 'Bill state' },
  { key: 'billing_address_zip_code', label: 'Bill ZIP' },
  { key: 'billing_address_country', label: 'Bill country' },
  { key: 'shipping_same_as_billing', label: 'Ship same as bill' },
  { key: 'shipping_address_street_1', label: 'Ship street 1' },
  { key: 'shipping_address_street_2', label: 'Ship street 2' },
  { key: 'shipping_address_city', label: 'Ship city' },
  { key: 'shipping_address_state', label: 'Ship state' },
  { key: 'shipping_address_zip_code', label: 'Ship ZIP' },
  { key: 'shipping_address_country', label: 'Ship country' },
  { key: 'notes', label: 'Notes' },
  { key: 'primary_payment_method', label: 'Payment method' },
  { key: 'payment_terms', label: 'Payment terms' },
  { key: 'invoice_language', label: 'Invoice lang' },
  { key: 'opening_balance', label: 'Opening balance' },
  { key: 'created_at', label: 'Joined', sortKey: 'created_at' },
  { key: 'updated_at', label: 'Updated', sortKey: 'updated_at' },
];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCellValue(row: CRMCustomerRow, key: keyof CRMCustomerRow): string {
  const v = row[key];
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 50) + (JSON.stringify(v).length > 50 ? '…' : '');
  const s = String(v).trim();
  return s || '—';
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: SortKey, dir: 'asc' | 'desc') => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative flex items-center justify-between gap-3 w-full min-w-0" ref={ref}>
      <span className="font-semibold text-white whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-0.5 rounded hover:bg-white/20 transition-colors text-white cursor-pointer"
        aria-label="Sort options"
      >
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg text-black">
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
            onClick={() => { onSort(sortKey, 'asc'); setOpen(false); }}
          >
            Ascending (A→Z)
          </button>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
            onClick={() => { onSort(sortKey, 'desc'); setOpen(false); }}
          >
            Descending (Z→A)
          </button>
        </div>
      )}
    </div>
  );
}

export type CRMCustomerFormData = {
  firstName: string;
  lastName: string;
  companyName: string;
  displayName: string;
  email: string;
  phone: string;
  mobileNumber: string;
  website: string;
  addressSearch: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  billingStreet1: string;
  billingStreet2: string;
  billingCity: string;
  billingState: string;
  billingZipCode: string;
  billingCountry: string;
  shippingSameAsBilling: boolean;
  shippingStreet1: string;
  shippingStreet2: string;
  shippingCity: string;
  shippingState: string;
  shippingZipCode: string;
  shippingCountry: string;
  notes: string;
  primaryPaymentMethod: string;
  paymentTerms: string;
  invoiceLanguage: 'en' | 'es';
  openingBalance: string;
};

const emptyForm: CRMCustomerFormData = {
  firstName: '',
  lastName: '',
  companyName: '',
  displayName: '',
  email: '',
  phone: '',
  mobileNumber: '',
  website: '',
  addressSearch: '',
  streetAddress: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
  billingStreet1: '',
  billingStreet2: '',
  billingCity: '',
  billingState: '',
  billingZipCode: '',
  billingCountry: '',
  shippingSameAsBilling: true,
  shippingStreet1: '',
  shippingStreet2: '',
  shippingCity: '',
  shippingState: '',
  shippingZipCode: '',
  shippingCountry: '',
  notes: '',
  primaryPaymentMethod: '',
  paymentTerms: '',
  invoiceLanguage: 'en',
  openingBalance: '',
};

type AccordionKey = 'nameAndContact' | 'addresses' | 'notesAndAttachments' | 'payments';

function CustomerForm({
  mode,
  initial,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial: Partial<CRMCustomerFormData>;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CRMCustomerFormData>({ ...emptyForm, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState<Record<AccordionKey, boolean>>({
    nameAndContact: true,
    addresses: true,
    notesAndAttachments: false,
    payments: false,
  });
  const firstInputRef = useRef<HTMLInputElement>(null);
  const tValidation = useTranslations('validation');

  useEffect(() => {
    if (mode === 'add') {
      firstInputRef.current?.focus();
    }
  }, [mode]);

  const update = (key: keyof CRMCustomerFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };
  const toggleAccordion = (key: AccordionKey) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trim = (s: string) => s.trim();
    const emailErr = validateCustomerEmail(trim(form.email));
    if (emailErr) {
      setError(tValidation(emailErr) as string);
      return;
    }
    const phoneErr = validateCustomerPhone(trim(form.phone), false);
    if (phoneErr) {
      setError(tValidation(phoneErr) as string);
      return;
    }
    const mobileErr = validateCustomerPhone(trim(form.mobileNumber), false);
    if (mobileErr) {
      setError(tValidation(mobileErr) as string);
      return;
    }
    setSaving(true);
    try {
      const id = (initial as { id?: string }).id;
      const url = id ? `/api/crm/customers/${id}` : '/api/crm/customers';
      const method = id ? 'PUT' : 'POST';
      const body: Record<string, unknown> = id
        ? {
            first_name: trim(form.firstName) || null,
            last_name: trim(form.lastName) || null,
            company_name: trim(form.companyName) || null,
            display_name: trim(form.displayName) || null,
            email: trim(form.email) || null,
            phone: trim(form.phone) || null,
            mobile_number: trim(form.mobileNumber) || null,
            website: trim(form.website) || null,
            street_address: trim(form.streetAddress) || null,
            apartment: trim(form.apartment) || null,
            city: trim(form.city) || null,
            state: trim(form.state) || null,
            zip_code: trim(form.zipCode) || null,
            billing_address_street_1: trim(form.billingStreet1) || null,
            billing_address_street_2: trim(form.billingStreet2) || null,
            billing_address_city: trim(form.billingCity) || null,
            billing_address_state: trim(form.billingState) || null,
            billing_address_zip_code: trim(form.billingZipCode) || null,
            billing_address_country: trim(form.billingCountry) || null,
            shipping_same_as_billing: form.shippingSameAsBilling,
            shipping_address_street_1: trim(form.shippingStreet1) || null,
            shipping_address_street_2: trim(form.shippingStreet2) || null,
            shipping_address_city: trim(form.shippingCity) || null,
            shipping_address_state: trim(form.shippingState) || null,
            shipping_address_zip_code: trim(form.shippingZipCode) || null,
            shipping_address_country: trim(form.shippingCountry) || null,
            notes: trim(form.notes) || null,
            primary_payment_method: trim(form.primaryPaymentMethod) || null,
            payment_terms: trim(form.paymentTerms) || null,
            invoice_language: form.invoiceLanguage,
            opening_balance: form.openingBalance === '' ? null : parseFloat(form.openingBalance) || 0,
          }
        : {
            first_name: trim(form.firstName),
            last_name: trim(form.lastName),
            company_name: trim(form.companyName) || null,
            display_name: trim(form.displayName) || null,
            email: trim(form.email) || null,
            phone: trim(form.phone) || null,
            mobile_number: trim(form.mobileNumber) || null,
            website: trim(form.website) || null,
            street_address: trim(form.streetAddress) || null,
            apartment: trim(form.apartment) || null,
            city: trim(form.city) || null,
            state: trim(form.state) || null,
            zip_code: trim(form.zipCode) || null,
            billing_address_street_1: trim(form.billingStreet1) || null,
            billing_address_street_2: trim(form.billingStreet2) || null,
            billing_address_city: trim(form.billingCity) || null,
            billing_address_state: trim(form.billingState) || null,
            billing_address_zip_code: trim(form.billingZipCode) || null,
            billing_address_country: trim(form.billingCountry) || null,
            shipping_same_as_billing: form.shippingSameAsBilling,
            shipping_address_street_1: trim(form.shippingStreet1) || null,
            shipping_address_street_2: trim(form.shippingStreet2) || null,
            shipping_address_city: trim(form.shippingCity) || null,
            shipping_address_state: trim(form.shippingState) || null,
            shipping_address_zip_code: trim(form.shippingZipCode) || null,
            shipping_address_country: trim(form.shippingCountry) || null,
            notes: trim(form.notes) || null,
            primary_payment_method: trim(form.primaryPaymentMethod) || null,
            payment_terms: trim(form.paymentTerms) || null,
            invoice_language: form.invoiceLanguage,
            opening_balance: form.openingBalance === '' ? null : parseFloat(form.openingBalance) || 0,
          };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (method === 'POST' ? 'Failed to create customer' : 'Failed to update customer'));
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="md:p-6 space-y-4 max-w-4xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      <Accordion
        title="Name and contact"
        isOpen={accordionOpen.nameAndContact}
        onToggle={() => toggleAccordion('nameAndContact')}
        required
        icon={<User className="w-5 h-5" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Row 1: First name, Last name, Company name */}
          <FormField label="First name" required>
            <Input ref={firstInputRef} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="First name" required />
          </FormField>
          <FormField label="Last name" required>
            <Input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="Last name" required />
          </FormField>
          <FormField label="Company name" className="sm:col-span-2 md:col-span-1">
            <Input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="Company name" />
          </FormField>
          {/* Row 2: Customer display name, Phone, Mobile number */}
          <FormField label="Customer display name" className="sm:col-span-2 md:col-span-1">
            <Input value={form.displayName} onChange={(e) => update('displayName', e.target.value)} placeholder="Name shown on forms" />
          </FormField>
          <FormField label="Phone">
            <Input type="tel" value={form.phone} onChange={(e) => update('phone', formatPhoneNumber(e.target.value))} placeholder="(702) 555-0123" />
          </FormField>
          <FormField label="Mobile number">
            <Input type="tel" value={form.mobileNumber} onChange={(e) => update('mobileNumber', formatPhoneNumber(e.target.value))} placeholder="Mobile" />
          </FormField>
          {/* Row 3: Email, Website */}
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@example.com" />
          </FormField>
          <FormField label="Website">
            <Input type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://..." />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Addresses"
        isOpen={accordionOpen.addresses}
        onToggle={() => toggleAccordion('addresses')}
        icon={<MapPin className="w-5 h-5" />}
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Billing address</h3>
            <FormField
              label="Search address"
              tip="Search to autofill street, city, state, and ZIP. You can also type an address and use “Use this address” if it’s not in the list."
              className="mb-4"
            >
              <AddressAutocomplete
                id="billing-address-search"
                value={form.addressSearch}
                onChange={(v) => update('addressSearch', v)}
                onAddressSelect={(addr: AddressData) => {
                  setForm((prev) => ({
                    ...prev,
                    addressSearch: addr.streetAddress || addr.fullAddress || '',
                    streetAddress: addr.streetAddress,
                    apartment: addr.apartment ?? prev.apartment,
                    city: addr.city,
                    state: addr.state,
                    zipCode: addr.zipCode,
                    billingStreet1: addr.streetAddress,
                    billingStreet2: addr.apartment ?? prev.billingStreet2,
                    billingCity: addr.city,
                    billingState: addr.state,
                    billingZipCode: addr.zipCode,
                    billingCountry: prev.billingCountry || 'United States',
                  }));
                  setError(null);
                }}
                placeholder="Enter your Nevada address"
              />
            </FormField>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <FormField label="Street address 1" className="col-span-2 md:col-span-1">
                <Input value={form.billingStreet1} onChange={(e) => update('billingStreet1', e.target.value)} placeholder="Street address 1" />
              </FormField>
              <FormField label="Street address 2" className="col-span-2 md:col-span-1">
                <Input value={form.billingStreet2} onChange={(e) => update('billingStreet2', e.target.value)} placeholder="Street address 2" />
              </FormField>
              <FormField label="City">
                <Input value={form.billingCity} onChange={(e) => update('billingCity', e.target.value)} placeholder="City" />
              </FormField>
              <FormField label="State">
                <Input value={form.billingState} onChange={(e) => update('billingState', e.target.value)} placeholder="State" />
              </FormField>
              <FormField label="ZIP code">
                <Input value={form.billingZipCode} onChange={(e) => update('billingZipCode', e.target.value)} placeholder="ZIP" />
              </FormField>
              <FormField label="Country">
                <Input value={form.billingCountry} onChange={(e) => update('billingCountry', e.target.value)} placeholder="Country" />
              </FormField>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Shipping address</h3>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="shippingSameAsBilling"
                checked={form.shippingSameAsBilling}
                onChange={(e) => update('shippingSameAsBilling', e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="shippingSameAsBilling" className="text-sm font-medium text-gray-700 cursor-pointer">Same as billing address</label>
            </div>
            {!form.shippingSameAsBilling && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <FormField label="Street address 1" className="col-span-2 md:col-span-1">
                  <Input value={form.shippingStreet1} onChange={(e) => update('shippingStreet1', e.target.value)} placeholder="Street address 1" />
                </FormField>
                <FormField label="Street address 2" className="col-span-2 md:col-span-1">
                  <Input value={form.shippingStreet2} onChange={(e) => update('shippingStreet2', e.target.value)} placeholder="Street address 2" />
                </FormField>
                <FormField label="City">
                  <Input value={form.shippingCity} onChange={(e) => update('shippingCity', e.target.value)} placeholder="City" />
                </FormField>
                <FormField label="State">
                  <Input value={form.shippingState} onChange={(e) => update('shippingState', e.target.value)} placeholder="State" />
                </FormField>
                <FormField label="ZIP code">
                  <Input value={form.shippingZipCode} onChange={(e) => update('shippingZipCode', e.target.value)} placeholder="ZIP" />
                </FormField>
                <FormField label="Country">
                  <Input value={form.shippingCountry} onChange={(e) => update('shippingCountry', e.target.value)} placeholder="Country" />
                </FormField>
              </div>
            )}
          </div>
        </div>
      </Accordion>

      <Accordion
        title="Notes and attachments"
        isOpen={accordionOpen.notesAndAttachments}
        onToggle={() => toggleAccordion('notesAndAttachments')}
        icon={<FileText className="w-5 h-5" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <FormField label="Notes" className="sm:col-span-2 md:col-span-3">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Additional notes"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-y"
            />
          </FormField>
          <FormField label="Attachments" className="sm:col-span-2 md:col-span-3">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <button type="button" className="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer">
                Add attachment
              </button>
              <p className="text-gray-500 text-xs mt-1">Max file size: 20 MB</p>
            </div>
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Payments"
        isOpen={accordionOpen.payments}
        onToggle={() => toggleAccordion('payments')}
        icon={<CreditCard className="w-5 h-5" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <FormField label="Primary payment method">
            <select
              value={form.primaryPaymentMethod}
              onChange={(e) => update('primaryPaymentMethod', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Select a primary payment method</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="ach">ACH</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label="Terms">
            <select
              value={form.paymentTerms}
              onChange={(e) => update('paymentTerms', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Select terms</option>
              <option value="Due on receipt">Due on receipt</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </FormField>
          <FormField label="Language to use when you send invoices">
            <select
              value={form.invoiceLanguage}
              onChange={(e) => update('invoiceLanguage', e.target.value as 'en' | 'es')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </FormField>
          <FormField label="Opening balance">
            <Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => update('openingBalance', e.target.value)} placeholder="0.00" />
          </FormField>
        </div>
      </Accordion>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Saving…' : mode === 'add' ? 'Add Customer' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMCustomersPage() {
  const [customers, setCustomers] = useState<CRMCustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<(CRMCustomerFormData & { id?: string }) | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; firstName: string | null; lastName: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchCustomers = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    try {
      if (isFirstLoad) setIsLoading(true);
      else setIsRefetching(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
      if (search) params.set('search', search);
      const res = await fetch(`/api/crm/customers?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCustomers(data.customers ?? []);
      setTotal(data.total ?? 0);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      if (isFirstLoad) { setCustomers([]); setTotal(0); }
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [page, sortBy, sortDir, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!actionsMenuRef.current?.contains(target) && !actionsButtonRef.current?.contains(target)) {
        setOpenActionsId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionsId]);

  useEffect(() => {
    if (viewMode !== 'edit' || !editingId) return;
    let cancelled = false;
    setEditingInitial(null);
    fetch(`/api/crm/customers/${editingId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const empty = (v: unknown) => (v == null || String(v).trim() === '' ? '' : String(v).trim());
        const num = (v: unknown) => (typeof v === 'number' ? String(v) : '');
        setEditingInitial({
          id: editingId,
          firstName: empty(data.first_name),
          lastName: empty(data.last_name),
          companyName: empty(data.company_name),
          displayName: empty(data.display_name),
          email: empty(data.email),
          phone: empty(data.phone),
          mobileNumber: empty(data.mobile_number),
          website: empty(data.website),
          addressSearch: empty(data.billing_address_street_1) || empty(data.street_address),
          streetAddress: empty(data.street_address),
          apartment: empty(data.apartment),
          city: empty(data.city),
          state: empty(data.state),
          zipCode: empty(data.zip_code),
          billingStreet1: empty(data.billing_address_street_1),
          billingStreet2: empty(data.billing_address_street_2),
          billingCity: empty(data.billing_address_city),
          billingState: empty(data.billing_address_state),
          billingZipCode: empty(data.billing_address_zip_code),
          billingCountry: empty(data.billing_address_country),
          shippingSameAsBilling: data.shipping_same_as_billing !== false,
          shippingStreet1: empty(data.shipping_address_street_1),
          shippingStreet2: empty(data.shipping_address_street_2),
          shippingCity: empty(data.shipping_address_city),
          shippingState: empty(data.shipping_address_state),
          shippingZipCode: empty(data.shipping_address_zip_code),
          shippingCountry: empty(data.shipping_address_country),
          notes: empty(data.notes),
          primaryPaymentMethod: empty(data.primary_payment_method),
          paymentTerms: empty(data.payment_terms),
          invoiceLanguage: data.invoice_language === 'es' ? 'es' : 'en',
          openingBalance: num(data.opening_balance),
        });
      })
      .catch(() => { if (!cancelled) setEditingInitial({ ...emptyForm, id: editingId }); });
    return () => { cancelled = true; };
  }, [viewMode, editingId]);

  const handleSort = (key: SortKey, dir: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };
  const handleDeleteCustomer = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/customers/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Customers</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage your customer contacts.</p>
            </div>
            <div className="md:hidden h-9 px-4 rounded-md border-2 border-black bg-white flex items-center justify-center shrink-0 text-sm font-medium text-black">
              {total} customer{total !== 1 ? 's' : ''}
            </div>
            <Button variant="primary" size="sm" className="hidden md:flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </div>
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-4xl md:mx-auto">
          <div className="py-2 md:py-0 md:mb-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); }}
              className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer"
              aria-label="Back to customers"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline">Back</span>
            </button>
            <span className="text-lg md:text-xl font-semibold text-gray-900">
              {viewMode === 'add' ? 'Add Customer' : 'Edit Customer'}
            </span>
          </div>
          {viewMode === 'add' && (
            <CustomerForm
              mode="add"
              initial={emptyForm}
              onCancel={() => setViewMode('table')}
              onSuccess={() => { setViewMode('table'); fetchCustomers(); }}
            />
          )}
          {viewMode === 'edit' && (
            editingInitial ? (
              <CustomerForm
                mode="edit"
                initial={editingInitial}
                onCancel={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); }}
                onSuccess={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); fetchCustomers(); }}
              />
            ) : (
              <div className="p-12 text-center text-gray-500 text-sm">Loading customer…</div>
            )
          )}
        </div>
      )}

      {viewMode === 'table' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name, city, state…"
                  className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-md text-sm bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
              <button type="submit" className="h-9 px-4 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer">
                Search
              </button>
            </form>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            {isLoading && !hasLoadedOnce ? (
              <div className="p-12 text-center text-gray-500 text-sm">Loading customers…</div>
            ) : (
              <div className="overflow-x-auto relative">
                {isRefetching && (
                  <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg" aria-hidden>
                    <span className="text-sm text-gray-500">Updating…</span>
                  </div>
                )}
                <table className="w-full border-collapse whitespace-nowrap" style={{ minWidth: 'max-content' }}>
                  <thead>
                    <tr className="border-b-2 border-black bg-black text-white">
                      {CUSTOMER_TABLE_COLUMNS.map(({ key, label, sortKey }) => (
                        <th key={key} className="px-3 py-1.5 text-left border-r border-white/30 min-w-[100px]">
                          {sortKey && SORT_OPTIONS.some((o) => o.value === sortKey) ? (
                            <SortHeader label={label} sortKey={sortKey} currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                          ) : (
                            <span className="font-semibold text-white">{label}</span>
                          )}
                        </th>
                      ))}
                      <th className="sticky right-0 z-10 py-1.5 text-center bg-black border-l-2 border-white w-[72px] min-w-[72px]">
                        <span className="font-semibold text-white">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={CUSTOMER_TABLE_COLUMNS.length + 1} className="px-4 py-12 text-center text-gray-500 text-sm">
                          No customers found.
                        </td>
                      </tr>
                    ) : (
                      customers.map((row) => (
                        <tr
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { setEditingId(row.id); setViewMode('edit'); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setEditingId(row.id);
                              setViewMode('edit');
                            }
                          }}
                          className="group border-b border-gray-100 hover:bg-gray-50/80 transition-colors cursor-pointer"
                        >
                          {CUSTOMER_TABLE_COLUMNS.map(({ key }) => (
                            <td key={key} className="px-3 py-1.5 text-sm text-gray-700 max-w-[200px] overflow-hidden truncate" title={formatCellValue(row, key)}>
                              {key === 'created_at' || key === 'updated_at' ? formatDate(row[key] as string | null) : formatCellValue(row, key)}
                            </td>
                          ))}
                          <td
                            className="sticky right-0 z-10 py-1.5 text-center bg-white group-hover:bg-gray-50/80 border-l-2 border-gray-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative flex justify-center items-center w-full">
                              <button
                                ref={openActionsId === row.id ? actionsButtonRef : undefined}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openActionsId === row.id) {
                                    setOpenActionsId(null);
                                    setMenuPosition(null);
                                    return;
                                  }
                                  const el = e.currentTarget;
                                  const rect = el.getBoundingClientRect();
                                  actionsButtonRef.current = el;
                                  const left = Math.min(rect.right - 120, window.innerWidth - 130);
                                  const spaceBelow = window.innerHeight - rect.bottom - 4;
                                  setMenuPosition({
                                    top: spaceBelow >= 80 ? rect.bottom + 4 : rect.top - 80 - 4,
                                    left,
                                  });
                                  setOpenActionsId(row.id);
                                }}
                                className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
                                aria-label="Actions"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isLoading && total > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                itemsPerPage={PAGE_SIZE}
                itemLabel="customers"
              />
            </div>
          )}
        </>
      )}

      {deleteConfirm && (
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => !deleting && setDeleteConfirm(null)}
          showHeader={false}
          showCloseButton={true}
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete customer?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{' '}
              <strong className="text-gray-900">
                {[deleteConfirm.firstName, deleteConfirm.lastName].filter(Boolean).join(' ') || 'this customer'}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => handleDeleteCustomer(deleteConfirm.id)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete customer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={actionsMenuRef}
            className="fixed z-[100] min-w-[120px] py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionsId(null);
                setMenuPosition(null);
                const row = customers.find((c) => c.id === openActionsId);
                if (row) { setEditingId(row.id); setViewMode('edit'); }
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 hover:text-red-700 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const row = customers.find((c) => c.id === openActionsId);
                if (row) {
                  setDeleteConfirm({ id: row.id, firstName: row.first_name, lastName: row.last_name });
                  setOpenActionsId(null);
                  setMenuPosition(null);
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )}

      {/* Mobile-only: fixed FAB to add customer (same style as nine-dot menu button) */}
      {viewMode === 'table' && (
        <button
          type="button"
          onClick={() => setViewMode('add')}
          className="md:hidden fixed bottom-6 right-4 z-50 h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all shadow-lg"
          aria-label="Add customer"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
}
