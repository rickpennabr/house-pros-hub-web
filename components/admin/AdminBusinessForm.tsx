'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import { Select } from '@/components/ui/Select';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import type { ProCardData } from '@/components/proscard/ProCard';
import type { LinkItem } from '@/components/proscard/ProLinks';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';

interface LicenseCategoryFromApi {
  id: string;
  code: string;
  name: string;
  requires_contractor_license: boolean;
  sort_order: number;
}

function buildLicenseOptions(categories: LicenseCategoryFromApi[]) {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  return [
    { value: '', label: 'Select…' },
    ...sorted.map((c) => ({ value: c.code, label: c.name })),
  ];
}

export interface AdminBusinessFormInitial {
  business: ProCardData & { userId?: string };
  is_active: boolean;
  is_verified: boolean;
}

export interface AdminBusinessFormData {
  businessName: string;
  slug: string;
  companyDescription: string;
  businessLogo: string;
  businessBackground: string;
  businessBackgroundPosition: string;
  email: string;
  phone: string;
  mobilePhone: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  licenses: Array<{ license: string; licenseNumber: string }>;
  services: Array<{ name: string }>;
  images: string[];
  links: LinkItem[];
  is_active: boolean;
  is_verified: boolean;
}

const emptyForm: AdminBusinessFormData = {
  businessName: '',
  slug: '',
  companyDescription: '',
  businessLogo: '',
  businessBackground: '',
  businessBackgroundPosition: '50% 50%',
  email: '',
  phone: '',
  mobilePhone: '',
  streetAddress: '',
  apartment: '',
  city: '',
  state: 'NV',
  zipCode: '',
  licenses: [{ license: '', licenseNumber: '' }],
  services: [],
  images: [],
  links: [],
  is_active: true,
  is_verified: false,
};

type AccordionKey = 'basic' | 'contact' | 'address' | 'licenses' | 'services' | 'images' | 'status';

interface AdminBusinessFormProps {
  businessId: string;
  initial: AdminBusinessFormInitial;
  onCancel: () => void;
  onSuccess: () => void;
}

function mapInitialToForm(initial: AdminBusinessFormInitial): AdminBusinessFormData {
  const b = initial.business;
  const licenses =
    b.licenses?.map((l) => ({
      license: l.license || '',
      licenseNumber: l.licenseNumber || '',
    })) ?? [{ license: '', licenseNumber: '' }];
  const services =
    Array.isArray(b.services) && b.services.length > 0
      ? b.services.map((s) => ({ name: typeof s === 'string' ? s : (s as { name?: string })?.name ?? '' }))
      : [];
  const images = Array.isArray(b.images) ? b.images : [];
  const links = normalizeLinks(b.links);

  return {
    ...emptyForm,
    businessName: b.businessName || '',
    slug: b.slug || '',
    companyDescription: b.companyDescription || '',
    businessLogo: b.businessLogo || b.logo || '',
    businessBackground: b.businessBackground || '',
    businessBackgroundPosition:
      (b as { businessBackgroundPosition?: string }).businessBackgroundPosition ?? '50% 50%',
    email: b.email || '',
    phone: b.phone || '',
    mobilePhone: b.mobilePhone || '',
    streetAddress: b.streetAddress || '',
    apartment: b.apartment || '',
    city: b.city || '',
    state: b.state || 'NV',
    zipCode: b.zipCode || '',
    licenses: licenses.length > 0 ? licenses : [{ license: '', licenseNumber: '' }],
    services,
    images,
    links,
    is_active: initial.is_active ?? true,
    is_verified: initial.is_verified ?? false,
  };
}

export function AdminBusinessForm({ businessId, initial, onCancel, onSuccess }: AdminBusinessFormProps) {
  const [form, setForm] = useState<AdminBusinessFormData>(() => mapInitialToForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseCategories, setLicenseCategories] = useState<LicenseCategoryFromApi[]>([]);
  const [accordionOpen, setAccordionOpen] = useState<Record<AccordionKey, boolean>>({
    basic: true,
    contact: false,
    address: false,
    licenses: false,
    services: false,
    images: false,
    status: false,
  });

  useEffect(() => {
    fetch('/api/license-categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories?.length) setLicenseCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const licenseOptions = useMemo(() => buildLicenseOptions(licenseCategories), [licenseCategories]);

  const toggleAccordion = (key: AccordionKey) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const update = <K extends keyof AdminBusinessFormData>(key: K, value: AdminBusinessFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const updateLicense = (index: number, field: 'license' | 'licenseNumber', value: string) => {
    setForm((prev) => {
      const next = [...prev.licenses];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, licenses: next };
    });
  };

  const addLicense = () => {
    setForm((prev) => ({ ...prev, licenses: [...prev.licenses, { license: '', licenseNumber: '' }] }));
  };

  const removeLicense = (index: number) => {
    setForm((prev) => {
      const next = prev.licenses.filter((_, i) => i !== index);
      return { ...prev, licenses: next.length > 0 ? next : [{ license: '', licenseNumber: '' }] };
    });
  };

  const addService = () => {
    setForm((prev) => ({ ...prev, services: [...prev.services, { name: '' }] }));
  };

  const updateService = (index: number, name: string) => {
    setForm((prev) => {
      const next = [...prev.services];
      next[index] = { name };
      return { ...prev, services: next };
    });
  };

  const removeService = (index: number) => {
    setForm((prev) => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const servicesPayload = form.services
        .map((s) => s.name?.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          businessName: form.businessName.trim() || undefined,
          slug: form.slug.trim() || undefined,
          companyDescription: form.companyDescription.trim() || undefined,
          businessLogo: form.businessLogo.trim() || undefined,
          businessBackground: form.businessBackground.trim() || undefined,
          businessBackgroundPosition: form.businessBackgroundPosition.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          mobilePhone: form.mobilePhone.trim() || undefined,
          streetAddress: form.streetAddress.trim() || undefined,
          apartment: form.apartment.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          zipCode: form.zipCode.trim() || undefined,
          licenses: form.licenses
            .filter((l) => l.license || l.licenseNumber)
            .map((l) => ({ license: l.license, licenseNumber: l.licenseNumber })),
          services: servicesPayload.length > 0 ? servicesPayload : undefined,
          images: form.images.length > 0 ? form.images : undefined,
          links: form.links.length > 0 ? form.links : undefined,
          is_active: form.is_active,
          is_verified: form.is_verified,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update business');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="md:p-6 space-y-4 max-w-xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      <Accordion
        title="Basic info"
        isOpen={accordionOpen.basic}
        onToggle={() => toggleAccordion('basic')}
        required
      >
        <div className="space-y-4">
          <FormField label="Business name" required>
            <Input
              value={form.businessName}
              onChange={(e) => update('businessName', e.target.value)}
              placeholder="Business name"
              required
            />
          </FormField>
          <FormField label="Slug" tip="URL-friendly identifier (lowercase, hyphens)">
            <Input
              value={form.slug}
              onChange={(e) => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="my-business"
            />
          </FormField>
          <FormField label="Company description">
            <textarea
              value={form.companyDescription}
              onChange={(e) => update('companyDescription', e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </FormField>
          <FormField label="Logo URL">
            <Input
              value={form.businessLogo}
              onChange={(e) => update('businessLogo', e.target.value)}
              placeholder="https://…"
            />
          </FormField>
          <FormField label="Background image URL">
            <Input
              value={form.businessBackground}
              onChange={(e) => update('businessBackground', e.target.value)}
              placeholder="https://…"
            />
          </FormField>
          <FormField label="Background position (e.g. 50% 50%)">
            <Input
              value={form.businessBackgroundPosition}
              onChange={(e) => update('businessBackgroundPosition', e.target.value)}
              placeholder="50% 50%"
            />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Contact"
        isOpen={accordionOpen.contact}
        onToggle={() => toggleAccordion('contact')}
      >
        <div className="space-y-4">
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="email@example.com"
            />
          </FormField>
          <FormField label="Phone">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', formatPhoneNumber(e.target.value))}
              placeholder="(702) 555-0123"
            />
          </FormField>
          <FormField label="Mobile phone">
            <Input
              type="tel"
              value={form.mobilePhone}
              onChange={(e) => update('mobilePhone', formatPhoneNumber(e.target.value))}
              placeholder="(702) 555-0123"
            />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Address"
        isOpen={accordionOpen.address}
        onToggle={() => toggleAccordion('address')}
      >
        <div className="space-y-4">
          <FormField label="Street address">
            <Input
              value={form.streetAddress}
              onChange={(e) => update('streetAddress', e.target.value)}
              placeholder="123 Main St"
            />
          </FormField>
          <FormField label="Apartment / Unit">
            <Input
              value={form.apartment}
              onChange={(e) => update('apartment', e.target.value)}
              placeholder="Apt, suite, etc."
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="City">
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="City" />
            </FormField>
            <FormField label="State">
              <Input
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="NV"
                maxLength={2}
              />
            </FormField>
          </div>
          <FormField label="ZIP code">
            <Input
              value={form.zipCode}
              onChange={(e) => update('zipCode', e.target.value)}
              placeholder="ZIP"
            />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Licenses"
        isOpen={accordionOpen.licenses}
        onToggle={() => toggleAccordion('licenses')}
      >
        <div className="space-y-4">
          {form.licenses.map((lic, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Select
                value={lic.license}
                onChange={(e) => updateLicense(i, 'license', e.target.value)}
                className="flex-1 min-w-0"
              >
                {licenseOptions.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Input
                value={lic.licenseNumber}
                onChange={(e) => updateLicense(i, 'licenseNumber', e.target.value)}
                placeholder="License number"
                className="flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => removeLicense(i)}
                className="p-2 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                aria-label="Remove license"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addLicense}>
            <Plus className="w-4 h-4 inline mr-1" />
            Add license
          </Button>
        </div>
      </Accordion>

      <Accordion
        title="Services"
        isOpen={accordionOpen.services}
        onToggle={() => toggleAccordion('services')}
      >
        <div className="space-y-4">
          {form.services.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={s.name}
                onChange={(e) => updateService(i, e.target.value)}
                placeholder="Service name"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeService(i)}
                className="p-2 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                aria-label="Remove service"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addService}>
            <Plus className="w-4 h-4 inline mr-1" />
            Add service
          </Button>
        </div>
      </Accordion>

      <Accordion
        title="Images"
        isOpen={accordionOpen.images}
        onToggle={() => toggleAccordion('images')}
      >
        <div className="space-y-2">
          <FormField label="Image URLs (one per line, max 10)">
            <textarea
              value={form.images.join('\n')}
              onChange={(e) =>
                update(
                  'images',
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 10)
                )
              }
              placeholder="https://…"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Status (admin)"
        isOpen={accordionOpen.status}
        onToggle={() => toggleAccordion('status')}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-black"
            />
            <span className="text-sm font-medium">Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_verified}
              onChange={(e) => update('is_verified', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-black"
            />
            <span className="text-sm font-medium">Verified</span>
          </label>
        </div>
      </Accordion>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
