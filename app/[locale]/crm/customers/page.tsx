'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle, User, MapPin, FileText, FileCheck, CreditCard, FolderOpen, PlusCircle, Mail, Globe } from 'lucide-react';
import { CRMSearchField } from '@/components/crm/CRMSearchField';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import Pagination from '@/components/ui/Pagination';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import { useSingleOpenAccordion } from '@/hooks/useSingleOpenAccordion';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import Modal from '@/components/ui/Modal';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { validateCustomerEmail, validateCustomerPhone } from '@/lib/schemas/crm';
import type { Database } from '@/lib/types/supabase';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { useWindowDimensions } from '@/hooks/useWindowDimensions';
import CustomerCard from '@/components/crm/CustomerCard';
import AddTaskModal from '@/components/crm/AddTaskModal';
import CustomerQuickActionsBar from '@/components/crm/CustomerQuickActionsBar';
import { ContactRolesField } from '@/components/crm/ContactRolesField';
import type { CrmContactRole } from '@/lib/crm/contact-role';

type CRMCustomerRow = Database['public']['Tables']['pro_crm_customers']['Row'] & {
  roles?: CrmContactRole[];
};

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Joined' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'display_id', label: 'Customer ID' },
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
  { key: 'display_id', label: 'Customer ID', sortKey: 'display_id' },
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

const mappedCustomerColumns: AdminDataTableColumn<CRMCustomerRow>[] = CUSTOMER_TABLE_COLUMNS.map(({ key, label, sortKey }) => ({
  id: key,
  label: key === 'display_id' ? 'Contact ID' : label,
  sortKey,
  width: key === 'notes' ? 240 : 150,
  wrap: key === 'notes',
}));
const displayNameColumnIndex = mappedCustomerColumns.findIndex((column) => column.id === 'display_name');
const CUSTOMER_COLUMNS: AdminDataTableColumn<CRMCustomerRow>[] = [
  ...mappedCustomerColumns.slice(0, displayNameColumnIndex + 1),
  { id: 'roles', label: 'Roles', width: 220 },
  ...mappedCustomerColumns.slice(displayNameColumnIndex + 1),
  { id: 'actions', label: 'Actions', resizable: false },
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

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter(Boolean).join(', ');
}

function customerMapAddress(row: CRMCustomerRow): string {
  return (
    joinAddress([row.street_address, row.apartment, row.city, row.state, row.zip_code]) ||
    joinAddress([
      row.billing_address_street_1,
      row.billing_address_street_2,
      row.billing_address_city,
      row.billing_address_state,
      row.billing_address_zip_code,
    ])
  );
}

function customerSheetText(row: CRMCustomerRow, columnId: string): string {
  if (columnId === 'roles') {
    return (row.roles ?? []).map((role) => role.name).join(', ');
  }
  if (columnId === 'created_at' || columnId === 'updated_at') {
    return formatDate(row[columnId]);
  }
  if (!(columnId in row)) return '';
  const formatted = formatCellValue(row, columnId as keyof CRMCustomerRow);
  return formatted === '—' ? '' : formatted;
}

function customerDisplayName(row: CRMCustomerRow): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  const fullName = [row.first_name?.trim(), row.last_name?.trim()].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (row.company_name?.trim()) return row.company_name.trim();
  return 'Customer';
}

export type CRMCustomerFormData = {
  displayId: string;
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
  roleIds?: string[];
};

const emptyForm: CRMCustomerFormData = {
  displayId: '',
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
  primaryPaymentMethod: 'check',
  paymentTerms: 'Due on receipt',
  invoiceLanguage: 'en',
  openingBalance: '',
};

const CRM_ACCORDION_KEYS = ['nameAndContact', 'addresses', 'notesAndAttachments', 'payments'] as const;
type AccordionKey = (typeof CRM_ACCORDION_KEYS)[number];

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
  const [roleIds, setRoleIds] = useState<string[]>(initial.roleIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingSearch, setShippingSearch] = useState('');
  const { isOpen, toggle: toggleAccordion } = useSingleOpenAccordion(CRM_ACCORDION_KEYS, 'nameAndContact');
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
            role_ids: roleIds,
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
            role_ids: roleIds,
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
    <form onSubmit={handleSubmit} className="md:p-0 space-y-4 max-w-4xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      <Accordion
        title="Name and contact"
        isOpen={isOpen('nameAndContact')}
        onToggle={() => toggleAccordion('nameAndContact')}
        required
        isComplete={Boolean(form.firstName.trim() && form.lastName.trim())}
        showCompleteStyle={false}
        icon={<User className="w-5 h-5" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <ContactRolesField selectedIds={roleIds} onChange={setRoleIds} />
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
          <FormField label="Display name" className="sm:col-span-2 md:col-span-1">
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
        isOpen={isOpen('addresses')}
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
                    apartment: addr.apartment || prev.apartment,
                    city: addr.city,
                    state: addr.state,
                    zipCode: addr.zipCode,
                    billingStreet1: addr.streetAddress,
                    billingStreet2: addr.apartment || prev.billingStreet2,
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
              <>
              <FormField
                label="Search address"
                tip="Search to fill the shipping address. A unit number you type is kept."
                className="mb-4"
              >
                <AddressAutocomplete
                  id="shipping-address-search"
                  value={shippingSearch}
                  onChange={setShippingSearch}
                  onAddressSelect={(addr: AddressData) => {
                    setShippingSearch(addr.streetAddress || addr.fullAddress || '');
                    setForm((prev) => ({
                      ...prev,
                      shippingStreet1: addr.streetAddress,
                      shippingStreet2: addr.apartment || prev.shippingStreet2,
                      shippingCity: addr.city,
                      shippingState: addr.state,
                      shippingZipCode: addr.zipCode,
                      shippingCountry: prev.shippingCountry || 'United States',
                    }));
                    setError(null);
                  }}
                  placeholder="Enter your Nevada address"
                />
              </FormField>
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
              </>
            )}
          </div>
        </div>
      </Accordion>

      <Accordion
        title="Notes and attachments"
        isOpen={isOpen('notesAndAttachments')}
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
        isOpen={isOpen('payments')}
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
          {saving ? 'Saving…' : mode === 'add' ? 'Create contact' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMCustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const crmChrome = useCRMChrome();
  const setCustomerCount = crmChrome?.setCustomerCount;
  const cardSearchRef = useRef<HTMLFormElement | null>(null);
  const [customers, setCustomers] = useState<CRMCustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [roleCatalog, setRoleCatalog] = useState<CrmContactRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedOnce || roleFilter) return;
    setCustomerCount?.(total);
  }, [hasLoadedOnce, total, setCustomerCount, roleFilter]);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  useEffect(() => {
    if (viewMode !== 'table') return;
    let cancelled = false;
    fetch('/api/crm/roles', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { roles?: CrmContactRole[] }) => {
        if (!cancelled) setRoleCatalog(data.roles ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewMode]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<(CRMCustomerFormData & { id?: string }) | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; firstName: string | null; lastName: string | null } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskCustomerContext, setTaskCustomerContext] = useState<{ id: string; name: string } | null>(null);

  const [savedListView, setSavedListView] = useLocalStorage<string>('crmCustomersView', 'card');
  const listView: ViewType = savedListView === 'card' || savedListView === 'list' || savedListView === 'map' ? savedListView : 'card';
  const setListView = (v: ViewType) => setSavedListView(v);
  const { isAtBottom } = useScrollPosition({ threshold: 50 });
  const { isMobile } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setViewMode('add');
      setEditingId(null);
      setEditingInitial(null);
    }
  }, [searchParams]);
  const isMobileSafe = mounted && isMobile;
  const showViewToggle = viewMode === 'table' && !isLoading;
  const bottomPadding = showViewToggle && isAtBottom ? (isMobileSafe ? 'pb-[72px]' : 'pb-[140px]') : '';
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
      if (roleFilter) params.set('role', roleFilter);
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
  }, [page, sortBy, sortDir, search, roleFilter]);

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
          displayId: empty(data.display_id),
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
          roleIds: Array.isArray(data.roles) ? data.roles.map((role: { id: string }) => role.id) : [],
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
  const searchDebounceRef = useRef<number | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 200);
  };
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    setSearch(searchInput.trim());
    setPage(1);
  };
  useEffect(() => () => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
  }, []);
  useEffect(() => {
    if (listView === 'list' || !crmChrome?.searchOpen) return;
    const close = (event: PointerEvent) => {
      if (cardSearchRef.current?.contains(event.target as Node)) return;
      crmChrome.setSearchOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [crmChrome, listView]);
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
  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteIds?.length) return;
    setDeleting(true);
    setError(null);
    try {
      for (const id of bulkDeleteIds) {
        const res = await fetch(`/api/crm/customers/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
      }
      setBulkDeleteIds(null);
      fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customers');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const editingCustomerName = editingInitial
    ? [editingInitial.displayName, editingInitial.companyName, [editingInitial.firstName, editingInitial.lastName].filter(Boolean).join(' ')]
        .find((name) => Boolean(name && name.trim())) || 'Customer'
    : 'Customer';
  const editingPrimaryPhone = editingInitial ? (editingInitial.mobileNumber || editingInitial.phone || null) : null;
  const editingDisplayId = editingInitial?.displayId || null;
  const editingPhoneHref = editingPrimaryPhone ? `tel:${editingPrimaryPhone.replace(/[^\d+]/g, '')}` : null;

  return (
    <div className={`w-full ${bottomPadding}`}>
      {viewMode === 'table' && (
        <>
          <div className="max-md:hidden! md:flex md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 inline-flex items-center gap-2">
                Contacts
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border-2 border-black bg-white px-1 text-xs font-semibold text-black">
                  {total}
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">People and companies you work with. A contact can have more than one role.</p>
            </div>
            <Button variant="primary" size="sm" className="hidden md:flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New contact
            </Button>
          </div>
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-4xl md:mx-auto">
          {viewMode === 'edit' && editingId && editingInitial && (
            <CustomerQuickActionsBar
              customerName={editingCustomerName}
              customerDisplayId={editingDisplayId}
              phoneHref={editingPhoneHref}
              onBack={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); }}
              onAddEstimate={() => router.push(`/${locale}/crm/estimates?customerId=${editingId}`)}
              onAddInvoice={() => router.push(`/${locale}/crm/invoices/new?customerId=${editingId}`)}
              onAddProject={() => router.push(`/${locale}/crm/projects?customerId=${editingId}`)}
              onScheduleTask={() => setShowAddTaskModal(true)}
            />
          )}
          {viewMode === 'add' && (
            <div className="py-2 md:py-0 md:mb-3 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); }}
                className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer"
                aria-label="Back to customers"
              >
                <ArrowLeft className="w-5 h-5 shrink-0" />
                <span className="hidden md:inline">Back</span>
              </button>
              <span className="text-lg md:text-xl font-semibold text-gray-900">New contact</span>
            </div>
          )}
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
          {roleCatalog.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-3">
              <button
                type="button"
                onClick={() => { setRoleFilter(''); setPage(1); }}
                className={`rounded-full border-2 border-black px-3 py-1 text-sm font-medium cursor-pointer ${roleFilter === '' ? 'bg-black text-white' : 'bg-white text-black'}`}
              >
                All
              </button>
              {roleCatalog.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => { setRoleFilter(role.slug); setPage(1); }}
                  className={`rounded-full border-2 border-black px-3 py-1 text-sm font-medium cursor-pointer ${roleFilter === role.slug ? 'bg-black text-white' : 'bg-white text-black'}`}
                >
                  {role.name}
                </button>
              ))}
            </div>
          )}
          {listView !== 'list' && (
          <CRMSearchField
            formRef={cardSearchRef}
            value={searchInput}
            onChange={handleSearchInput}
            placeholder="Search by name, city, state…"
            onFocus={() => crmChrome?.setSearchOpen(true)}
            onSubmit={handleSearchSubmit}
            showClose={Boolean(crmChrome?.searchOpen)}
            onClose={() => {
              crmChrome?.setSearchOpen(false);
              (document.activeElement as HTMLElement | null)?.blur();
            }}
            className="pt-2 pb-2 md:pt-0 max-w-md"
          />
          )}

          {listView !== 'list' && error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
          )}

          {listView === 'map' ? (
            <AddressPinsMap
              pins={customers.map((row) => ({
                id: row.id,
                title: customerDisplayName(row),
                detail: row.phone || row.email || undefined,
                address: customerMapAddress(row),
              }))}
              onOpen={(id) => { setEditingId(id); setViewMode('edit'); }}
            />
          ) : listView === 'card' ? (
            <div>
              {isLoading && !hasLoadedOnce ? (
                <div className="p-12 text-center text-gray-500 text-sm">Loading customers…</div>
              ) : customers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">No contacts found.</div>
              ) : (
                <div className="relative">
                  {isRefetching && (
                    <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg" aria-hidden>
                      <span className="text-sm text-gray-500">Updating…</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 min-[500px]:grid-cols-2 min-[768px]:grid-cols-3 min-[1100px]:grid-cols-4 gap-3 w-full">
                    {customers.map((row) => (
                      <CustomerCard
                        key={row.id}
                        customer={row}
                        onEdit={(id) => { setEditingId(id); setViewMode('edit'); }}
                        onCreateInvoice={(id) => router.push(`/${locale}/crm/invoices/new?customerId=${id}`)}
                        onCreateEstimate={(id) => router.push(`/${locale}/crm/estimates?customerId=${id}`)}
                        onCreateProject={(id) => router.push(`/${locale}/crm/projects?customerId=${id}`)}
                        onScheduleTask={(id) => {
                          const customer = customers.find((customerRow) => customerRow.id === id);
                          if (customer) {
                            setTaskCustomerContext({ id: customer.id, name: customerDisplayName(customer) });
                            setShowAddTaskModal(true);
                          }
                        }}
                        onDelete={(id) => {
                          const c = customers.find((x) => x.id === id);
                          if (c) setDeleteConfirm({ id: c.id, firstName: c.first_name, lastName: c.last_name });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <AdminDataTable
              searchRowClassName="pt-2 md:pt-0"
              columnOrderKey="crm-customers"
              exportName="customers"
              columns={CUSTOMER_COLUMNS}
              data={customers}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={(key, dir) => {
                if ((SORT_OPTIONS as readonly { value: string }[]).some((option) => option.value === key)) {
                  handleSort(key as SortKey, dir);
                }
              }}
              searchInput={searchInput}
              onSearchInput={handleSearchInput}
              onSearchSubmit={handleSearchSubmit}
              searchPlaceholder="Search by name, city, state…"
              isLoading={isLoading}
              isRefetching={isRefetching}
              hasLoadedOnce={hasLoadedOnce}
              error={error}
              getRowId={(row) => row.id}
              getCellText={customerSheetText}
              renderCell={(row, columnId) => customerSheetText(row, columnId) || '—'}
              onRowClick={(row) => { setEditingId(row.id); setViewMode('edit'); }}
              renderActions={(row) => (
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
                    const menuWidth = 220;
                    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                    setMenuPosition({
                      top: spaceBelow >= 320 ? rect.bottom + 4 : rect.top - 4,
                      left,
                      above: spaceBelow < 320,
                    });
                    setOpenActionsId(row.id);
                  }}
                  className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
                  aria-label="Actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              )}
              bulkActions={{
                onDelete: (ids) => setBulkDeleteIds(ids),
                onCopyAsJson: (rows) => {
                  void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
                },
                onEdit: (row) => { setEditingId(row.id); setViewMode('edit'); },
              }}
              emptyMessage="No contacts found."
              itemLabel="customers"
              primaryColumnId="display_name"
              tableLayoutMinWidth={960}
            />
          )}

          {listView !== 'list' && !isLoading && total > 0 && (
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

      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal
          isOpen
          onClose={() => !deleting && setBulkDeleteIds(null)}
          showHeader={false}
          showCloseButton
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete customers?</h2>
            <p className="text-gray-600 mb-6">
              Delete {bulkDeleteIds.length} customer{bulkDeleteIds.length === 1 ? '' : 's'}? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={() => setBulkDeleteIds(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => void handleBulkDeleteConfirm()}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={actionsMenuRef}
            className="fixed z-[100] min-w-[220px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              transform: menuPosition.above ? 'translateY(-100%)' : undefined,
            }}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionsId(null);
                setMenuPosition(null);
                if (openActionsId) router.push(`/${locale}/crm/invoices/new?customerId=${openActionsId}`);
              }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              Create invoice
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionsId(null);
                setMenuPosition(null);
                if (openActionsId) router.push(`/${locale}/crm/estimates?customerId=${openActionsId}`);
              }}
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              Create estimate
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionsId(null);
                setMenuPosition(null);
                if (openActionsId) router.push(`/${locale}/crm/projects?customerId=${openActionsId}`);
              }}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              Create project
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const row = customers.find((c) => c.id === openActionsId);
                if (row) {
                  setTaskCustomerContext({ id: row.id, name: customerDisplayName(row) });
                  setShowAddTaskModal(true);
                }
                setOpenActionsId(null);
                setMenuPosition(null);
              }}
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              Schedule task
            </button>
            {(() => {
              const row = customers.find((c) => c.id === openActionsId);
              if (!row) return null;

              const emailHref = row.email?.trim() ? `mailto:${row.email.trim()}` : null;
              const websiteHref = row.website?.trim()
                ? (row.website.trim().startsWith('http') ? row.website.trim() : `https://${row.website.trim()}`)
                : null;
              const mapsQuery = [row.street_address, row.apartment, row.city, row.state, row.zip_code]
                .filter((part) => Boolean(part && String(part).trim()))
                .join(', ');
              const mapsHref = mapsQuery ? `https://maps.google.com/?q=${encodeURIComponent(mapsQuery)}` : null;

              return (
                <>
                  {emailHref && (
                    <a
                      href={emailHref}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                      onClick={() => { setOpenActionsId(null); setMenuPosition(null); }}
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      Email
                    </a>
                  )}
                  {mapsHref && (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                      onClick={() => { setOpenActionsId(null); setMenuPosition(null); }}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Map
                    </a>
                  )}
                  {websiteHref && (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                      onClick={() => { setOpenActionsId(null); setMenuPosition(null); }}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      Website
                    </a>
                  )}
                </>
              );
            })()}
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
              <Pencil className="w-3.5 h-3.5 shrink-0" />
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
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              Delete
            </button>
          </div>,
          document.body
        )}

      {/* View toggle at page bottom (Card / List / Map) with New on the right */}
      {viewMode === 'table' && !isLoading && (
        <ViewToggle
          currentView={listView}
          onViewChange={setListView}
          views={['card', 'list', 'map']}
          hideBackgroundToggle
          onAdd={() => setViewMode('add')}
          addLabel="New contact"
        />
      )}

      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => {
          setShowAddTaskModal(false);
          setTaskCustomerContext(null);
        }}
        onSuccess={() => {
          setShowAddTaskModal(false);
          setTaskCustomerContext(null);
        }}
        initialCustomerId={taskCustomerContext?.id ?? editingId}
        initialMeetingWith={taskCustomerContext?.name ?? editingCustomerName}
      />
    </div>
  );
}
