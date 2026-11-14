'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { ArrowLeft, Plus, Trash2, Building2, X } from 'lucide-react';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import { useSingleOpenAccordion } from '@/hooks/useSingleOpenAccordion';
import { Select } from '@/components/ui/Select';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import type { ProCardData } from '@/components/proscard/ProCard';
import type { LinkItem } from '@/components/proscard/ProLinks';
import { MAX_BUSINESS_GALLERY_IMAGES } from '@/lib/constants/businessGallery';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { parseObjectPosition, formatObjectPosition } from '@/lib/utils/backgroundPosition';
import { BackgroundImageEdit } from '@/components/businessdetails/BackgroundImageEdit';
import Modal from '@/components/ui/Modal';

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

const ADMIN_BUSINESS_ACCORDION_KEYS = ['brand', 'basic', 'contact', 'address', 'licenses', 'services', 'images', 'status'] as const;

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
  const { isOpen, toggle: toggleAccordion } = useSingleOpenAccordion(ADMIN_BUSINESS_ACCORDION_KEYS, 'brand');

  const [savedBgPosition, setSavedBgPosition] = useState(form.businessBackgroundPosition);
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [showAdjustHint, setShowAdjustHint] = useState(false);
  const [dragStart, setDragStart] = useState<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const [imageErrorModal, setImageErrorModal] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const bgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSavedBgPosition(form.businessBackgroundPosition); }, [form.businessBackgroundPosition]);
  useEffect(() => {
    if (!showAdjustHint) return;
    const t = setTimeout(() => setShowAdjustHint(false), 4000);
    return () => clearTimeout(t);
  }, [showAdjustHint]);
  useEffect(() => {
    if (!dragStart || !bgContainerRef.current) return;
    const onMove = (e: MouseEvent) => {
      const rect = bgContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const deltaX = ((e.clientX - dragStart.clientX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStart.clientY) / rect.height) * 100;
      const newX = Math.min(100, Math.max(0, dragStart.posX - deltaX));
      const newY = Math.min(100, Math.max(0, dragStart.posY - deltaY));
      update('businessBackgroundPosition', formatObjectPosition(newX, newY));
    };
    const onUp = () => setDragStart(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragStart]);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setImageErrorModal('Please select an image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageErrorModal('Logo must be 5MB or less.');
      return;
    }
    setLogoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('businessId', businessId);
      const res = await fetch('/api/storage/upload-business-logo', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      update('businessLogo', data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setImageErrorModal('Please select an image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageErrorModal('Background must be 5MB or less.');
      return;
    }
    setBgUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('businessId', businessId);
      const res = await fetch('/api/storage/upload-business-background', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      update('businessBackground', data.url);
      update('businessBackgroundPosition', '50% 50%');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Background upload failed');
    } finally {
      setBgUploading(false);
    }
  };

  useEffect(() => {
    fetch('/api/license-categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories?.length) setLicenseCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const licenseOptions = useMemo(() => buildLicenseOptions(licenseCategories), [licenseCategories]);

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

  const logoPreview = form.businessLogo?.trim() || null;
  const bgPreview = form.businessBackground?.trim() || null;

  return (
    <form onSubmit={handleSubmit} className="md:p-6 space-y-4 max-w-xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      <Accordion
        title="Logo & background"
        isOpen={isOpen('brand')}
        onToggle={() => toggleAccordion('brand')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Preview and upload logo and hero background (same idea as business signup). You can also paste URLs below.</p>
          <div className="relative w-full h-[200px] md:h-[260px] rounded-lg border-2 border-black bg-white group">
            <div ref={bgContainerRef} className="absolute inset-0 overflow-hidden rounded-lg">
              {bgPreview ? (
                <>
                  <Image
                    src={bgPreview}
                    alt="Background preview"
                    fill
                    sizes="600px"
                    className="object-cover"
                    style={{ objectPosition: form.businessBackgroundPosition }}
                    unoptimized
                  />
                  {showAdjustHint && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[25] px-2 py-1 rounded bg-black/80 text-white text-xs font-medium">
                      Drag to position
                    </div>
                  )}
                  {isAdjustMode ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        const pos = parseObjectPosition(form.businessBackgroundPosition);
                        setDragStart({ clientX: e.clientX, clientY: e.clientY, posX: pos.x, posY: pos.y });
                      }}
                      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                      aria-label="Drag to position background"
                    />
                  ) : (
                    <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden />
                  )}
                  <div className="absolute bottom-2 right-2 flex gap-2 z-20">
                    <BackgroundImageEdit
                      inline
                      position={form.businessBackgroundPosition}
                      savedPosition={savedBgPosition}
                      onSave={() => { setSavedBgPosition(form.businessBackgroundPosition); setIsAdjustMode(false); }}
                      onPositionChange={(pos) => update('businessBackgroundPosition', pos)}
                      onUploadClick={() => bgInputRef.current?.click()}
                      onAdjustClick={() => { setSavedBgPosition(form.businessBackgroundPosition); setShowAdjustHint(true); setIsAdjustMode(true); }}
                      adjustImageLabel="Adjust image"
                      uploadNewLabel="Upload new"
                    />
                    <button
                      type="button"
                      onClick={() => update('businessBackground', '')}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black hover:bg-gray-50"
                      aria-label="Remove background"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => bgInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50/50"
                >
                  <Building2 className="w-10 h-10 opacity-30" />
                  <span className="text-xs font-medium mt-1">Click to upload background</span>
                  {bgUploading && <span className="text-xs mt-0.5">Uploading…</span>}
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="relative w-20 h-20 rounded-lg border-4 border-white bg-white shadow-xl overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-95"
              >
                {logoPreview ? (
                  <Image src={logoPreview} alt="Logo" fill sizes="80px" className="object-cover object-center" unoptimized />
                ) : (
                  <div className="relative z-10 w-full h-full bg-black flex flex-col items-center justify-center text-white gap-0.5 p-1">
                    <Building2 className="w-5 h-5" />
                    <span className="text-[8px] font-bold uppercase">Logo</span>
                    {logoUploading && <span className="text-[8px]">…</span>}
                  </div>
                )}
              </div>
              {logoPreview && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); update('businessLogo', ''); }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-white hover:bg-red-600"
                  aria-label="Remove logo"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
          <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgFileChange} className="hidden" />
          <FormField label="Logo URL">
            <Input
              value={form.businessLogo}
              onChange={(e) => update('businessLogo', e.target.value)}
              placeholder="https://… or upload above"
            />
          </FormField>
          <FormField label="Background image URL">
            <Input
              value={form.businessBackground}
              onChange={(e) => update('businessBackground', e.target.value)}
              placeholder="https://… or upload above"
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
        title="Basic info"
        isOpen={isOpen('basic')}
        onToggle={() => toggleAccordion('basic')}
        required
        isComplete={!!form.businessName?.trim()}
        showCompleteStyle={false}
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
        </div>
      </Accordion>

      <Accordion
        title="Contact"
        isOpen={isOpen('contact')}
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
        isOpen={isOpen('address')}
        onToggle={() => toggleAccordion('address')}
      >
        <div className="space-y-4">
          <FormField label="Street address">
            <AddressAutocomplete
              id="admin-business-street"
              value={form.streetAddress}
              onChange={(value) => update('streetAddress', value)}
              onAddressSelect={(address: AddressData) => {
                update('streetAddress', address.streetAddress);
                if (address.apartment) update('apartment', address.apartment);
                if (address.city) update('city', address.city);
                if (address.state) update('state', address.state);
                if (address.zipCode) update('zipCode', address.zipCode);
              }}
              placeholder="Start typing an address"
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
        isOpen={isOpen('licenses')}
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
        isOpen={isOpen('services')}
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
        isOpen={isOpen('images')}
        onToggle={() => toggleAccordion('images')}
      >
        <div className="space-y-2">
          <FormField label={`Image URLs (one per line, max ${MAX_BUSINESS_GALLERY_IMAGES})`}>
            <textarea
              value={form.images.join('\n')}
              onChange={(e) =>
                update(
                  'images',
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, MAX_BUSINESS_GALLERY_IMAGES)
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
        isOpen={isOpen('status')}
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

      <Modal isOpen={!!imageErrorModal} onClose={() => setImageErrorModal(null)} title="Image" showHeader showCloseButton maxWidth="sm">
        <p className="text-gray-700">{imageErrorModal}</p>
        <div className="mt-4">
          <Button type="button" variant="primary" size="sm" onClick={() => setImageErrorModal(null)}>OK</Button>
        </div>
      </Modal>
    </form>
  );
}
