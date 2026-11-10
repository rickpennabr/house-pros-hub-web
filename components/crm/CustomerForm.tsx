'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { User, MapPin, FileText, CreditCard } from 'lucide-react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import { useSingleOpenAccordion } from '@/hooks/useSingleOpenAccordion';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { validateCustomerEmail, validateCustomerPhone } from '@/lib/schemas/crm';
import { ContactRolesField } from '@/components/crm/ContactRolesField';

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

export const emptyForm: CRMCustomerFormData = {
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

export function CustomerForm({
  mode,
  initial,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial: Partial<CRMCustomerFormData>;
  onCancel: () => void;
  onSuccess: (created?: { id: string; name: string }) => void;
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
      const name =
        trim(form.displayName) ||
        trim(form.companyName) ||
        [trim(form.firstName), trim(form.lastName)].filter(Boolean).join(' ') ||
        'Contact';
      const createdId = typeof data.id === 'string' && data.id ? data.id : id;
      onSuccess(createdId ? { id: createdId, name } : undefined);
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
