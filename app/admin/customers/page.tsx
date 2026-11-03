'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle, User, X } from 'lucide-react';
import type { AdminCustomerRow } from '@/app/api/admin/customers/route';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import { useSingleOpenAccordion } from '@/hooks/useSingleOpenAccordion';
import { Select } from '@/components/ui/Select';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import Modal from '@/components/ui/Modal';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { resizeImageSquare, validateFileSize } from '@/lib/utils/image';
import { REFERRAL_BY_FRIEND, REFERRAL_BY_PREVIOUS_CUSTOMER, REFERRAL_OPTIONS, referralNeedsDetail, referralNeedsName } from '@/lib/constants/referral';
import { useReferralOptions } from '@/hooks/useReferralOptions';
import { ReferralOptionsEditor } from '@/components/admin/referral-options-editor';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Joined' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'last_name', label: 'Last name' },
  { value: 'first_name', label: 'First name' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'phone', label: 'Phone' },
  { value: 'referral', label: 'Referral' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const CUSTOMER_COLUMNS: AdminDataTableColumn<AdminCustomerRow>[] = [
  { id: 'name', label: 'Name', sortKey: 'last_name', width: 180 },
  { id: 'email', label: 'Email', width: 200 },
  { id: 'phone', label: 'Phone', sortKey: 'phone', width: 140 },
  { id: 'location', label: 'Location', sortKey: 'city', width: 160 },
  { id: 'referral', label: 'Referral', sortKey: 'referral', width: 140 },
  { id: 'joined', label: 'Joined', sortKey: 'created_at', width: 140 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function customerCellText(row: AdminCustomerRow, columnId: string) {
  switch (columnId) {
    case 'name':
      return `${row.first_name || ''} ${row.last_name || ''}`.trim();
    case 'email':
      return row.email || '';
    case 'phone':
      return row.phone || '';
    case 'location':
      return [row.city, row.state].filter(Boolean).join(', ');
    case 'referral':
      return [row.referral, row.referral_other].filter(Boolean).join(' — ');
    case 'joined':
      return formatDate(row.created_at);
    default:
      return '';
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function referralPayload(form: CustomerFormData) {
  if (form.referral === 'Other') {
    return {
      referral: form.referralOther.trim() || undefined,
      referralOther: '',
    };
  }
  if (referralNeedsName(form.referral)) {
    return {
      referral: form.referral.trim() || undefined,
      referralOther: form.referralOther.trim(),
    };
  }
  return {
    referral: form.referral.trim() || undefined,
    referralOther: '',
  };
}

export type CustomerFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  referral: string;
  referralOther: string;
  userPicture: string;
  addressSearch: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
};

const emptyForm: CustomerFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  referral: '',
  referralOther: '',
  userPicture: '',
  addressSearch: '',
  streetAddress: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
};

const ADMIN_CUSTOMER_ACCORDION_KEYS = ['personal', 'address', 'contact'] as const;
type CustomerAccordionKey = (typeof ADMIN_CUSTOMER_ACCORDION_KEYS)[number];

function CustomerForm({
  mode,
  initial,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial: Partial<CustomerFormData>;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CustomerFormData>({ ...emptyForm, ...initial });
  const extraReferrals = useReferralOptions();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOpen, toggle: toggleAccordion } = useSingleOpenAccordion(ADMIN_CUSTOMER_ACCORDION_KEYS, 'personal');
  const [pendingPictureFile, setPendingPictureFile] = useState<File | null>(null);
  const [picturePreviewUrl, setPicturePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof CustomerFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const customerId = mode === 'edit' ? (initial as { id?: string }).id : null;
  const pictureDisplayUrl = picturePreviewUrl || form.userPicture || null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (!validateFileSize(file, 5)) {
      setError('Image must be under 5MB.');
      return;
    }
    setError(null);
    if (mode === 'edit' && customerId) {
      try {
        const resized = await resizeImageSquare((await fileToDataUrl(file)) as string, 400, 0.85);
        const blob = await (await fetch(resized)).blob();
        const formData = new FormData();
        formData.append('file', blob, file.name);
        formData.append('userId', customerId);
        const res = await fetch('/api/admin/upload-profile-picture', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        update('userPicture', data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload picture');
      }
    } else {
      setPendingPictureFile(file);
      const url = URL.createObjectURL(file);
      setPicturePreviewUrl(url);
    }
    e.target.value = '';
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleRemovePicture = () => {
    update('userPicture', '');
    setPendingPictureFile(null);
    if (picturePreviewUrl) {
      URL.revokeObjectURL(picturePreviewUrl);
      setPicturePreviewUrl(null);
    }
    fileInputRef.current?.value && (fileInputRef.current.value = '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'add') {
        const res = await fetch('/api/admin/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: form.email.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim() || undefined,
            ...referralPayload(form),
            streetAddress: form.streetAddress.trim() || undefined,
            apartment: form.apartment.trim() || undefined,
            city: form.city.trim() || undefined,
            state: form.state.trim() || undefined,
            zipCode: form.zipCode.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to create customer');
        const newId = data.id as string | undefined;
        let userPictureUrl = form.userPicture || '';
        if (newId && pendingPictureFile) {
          try {
            const resized = await resizeImageSquare((await fileToDataUrl(pendingPictureFile)) as string, 400, 0.85);
            const blob = await (await fetch(resized)).blob();
            const formData = new FormData();
            formData.append('file', blob, pendingPictureFile.name);
            formData.append('userId', newId);
            const upRes = await fetch('/api/admin/upload-profile-picture', {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });
            const upData = await upRes.json().catch(() => ({}));
            if (upRes.ok && upData.url) userPictureUrl = upData.url;
          } catch {
            // non-fatal
          }
        }
        if (newId && userPictureUrl) {
          await fetch(`/api/admin/customers/${newId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              phone: form.phone.trim() || undefined,
              ...referralPayload(form),
              userPicture: userPictureUrl,
              streetAddress: form.streetAddress.trim() || undefined,
              apartment: form.apartment.trim() || undefined,
              city: form.city.trim() || undefined,
              state: form.state.trim() || undefined,
              zipCode: form.zipCode.trim() || undefined,
            }),
          });
        }
        onSuccess();
      } else {
        const id = (initial as { id?: string }).id;
        if (!id) throw new Error('Customer ID missing');
        const res = await fetch(`/api/admin/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim() || undefined,
            ...referralPayload(form),
            userPicture: form.userPicture.trim() || undefined,
            streetAddress: form.streetAddress.trim() || undefined,
            apartment: form.apartment.trim() || undefined,
            city: form.city.trim() || undefined,
            state: form.state.trim() || undefined,
            zipCode: form.zipCode.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to update customer');
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="md:p-6 space-y-4 max-w-xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Accordion 1: Personal & referral (same order as signup step 1: picture, referral, firstName, lastName) */}
      <Accordion
        title="Personal & referral"
        isOpen={isOpen('personal')}
        onToggle={() => toggleAccordion('personal')}
        required
      >
        <div className="space-y-4">
          {/* Profile picture - same as signup CustomerStep1 */}
          <section className="flex flex-col items-center gap-2">
            <div className="relative flex items-start justify-end gap-1.5">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className="w-24 h-24 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative aspect-square"
              >
                {pictureDisplayUrl ? (
                  <Image
                    src={pictureDisplayUrl}
                    alt="Profile"
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                ) : (
                  <User className="w-10 h-10 text-black" />
                )}
              </div>
              {pictureDisplayUrl && (
                <div className="flex flex-col gap-3 md:gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePicture();
                    }}
                    className="w-6 h-6 md:w-4 md:h-4 rounded bg-red-500 border-2 border-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg"
                    aria-label="Remove profile picture"
                  >
                    <X className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white font-bold" strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
            <span className="text-sm text-gray-600">Profile picture (optional)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={saving}
            />
          </section>

          <FormField label="How did you hear about us?" required tip="Help us understand how you found our platform">
            <Select
              value={form.referral}
              onChange={(e) => {
                const value = e.target.value;
                update('referral', value);
                if (!referralNeedsDetail(value)) update('referralOther', '');
              }}
              required
            >
              <option value="">Select…</option>
              {REFERRAL_OPTIONS.filter((opt) => opt !== 'Other').map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              {extraReferrals.map((opt) => (
                <option key={opt.id} value={opt.label}>{opt.label}</option>
              ))}
              <option value="Other">Other</option>
            </Select>
          </FormField>
          {referralNeedsName(form.referral) && (
            <FormField label={
              form.referral === REFERRAL_BY_FRIEND
                ? "Friend's name"
                : form.referral === REFERRAL_BY_PREVIOUS_CUSTOMER
                  ? "Previous customer's name"
                  : 'Name'
            }>
              <Input
                value={form.referralOther}
                onChange={(e) => update('referralOther', e.target.value)}
                placeholder="Name"
              />
            </FormField>
          )}
          {form.referral === 'Other' && (
            <FormField label="Please specify">
              <Input
                value={form.referralOther}
                onChange={(e) => update('referralOther', e.target.value)}
                placeholder="How did you hear about us?"
              />
            </FormField>
          )}
          <FormField label="First name" required>
            <Input
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="First name"
              required
            />
          </FormField>
          <FormField label="Last name" required>
            <Input
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              placeholder="Last name"
              required
            />
          </FormField>
        </div>
      </Accordion>

      {/* Accordion 2: Address (same order as signup step 2: address search, apartment, city, state, zip) */}
      <Accordion
        title="Address"
        isOpen={isOpen('address')}
        onToggle={() => toggleAccordion('address')}
      >
        <div className="space-y-4">
          <FormField label="Search address" tip="Address where services will be provided">
            <AddressAutocomplete
              value={form.addressSearch}
              onChange={(v) => update('addressSearch', v)}
              onAddressSelect={(addr: AddressData) => {
                setForm((prev) => ({
                  ...prev,
                  addressSearch: addr.streetAddress || addr.fullAddress || '',
                  streetAddress: addr.streetAddress || prev.streetAddress,
                  apartment: addr.apartment || prev.apartment,
                  city: addr.city || prev.city,
                  state: addr.state || prev.state,
                  zipCode: addr.zipCode || prev.zipCode,
                }));
                setError(null);
              }}
              placeholder="Enter address"
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
              <Input
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="City"
              />
            </FormField>
            <FormField label="State">
              <Input
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="e.g. NV"
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

      {/* Accordion 3: Contact & account (same order as signup step 3: phone, email, password) */}
      <Accordion
        title="Contact & account"
        isOpen={isOpen('contact')}
        onToggle={() => toggleAccordion('contact')}
        required
      >
        <div className="space-y-4">
          <FormField label="Phone" tip="For contact and unique identification">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', formatPhoneNumber(e.target.value))}
              placeholder="(702) 555-0123"
            />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="email@example.com"
              required
              disabled={mode === 'edit'}
            />
          </FormField>
          {mode === 'add' && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              We&apos;ll send this customer an email with a secure link to set their password. No password is sent by email.
            </p>
          )}
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
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

  const extraReferrals = useReferralOptions();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<(CustomerFormData & { id?: string }) | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const MENU_HEIGHT = 80;
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchCustomers = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    try {
      if (isFirstLoad) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/customers?${params}`, {
        credentials: 'include',
      });
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
      if (isFirstLoad) {
        setCustomers([]);
        setTotal(0);
      }
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [page, sortBy, sortDir, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      const inMenu = actionsMenuRef.current?.contains(target);
      const inButton = actionsButtonRef.current?.contains(target);
      if (!inMenu && !inButton) {
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
    fetch(`/api/admin/customers/${editingId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const referralVal = (data.referral ?? '').trim();
        const savedName = (data.referralOther ?? '').trim();
        const isKnownReferral = (REFERRAL_OPTIONS as readonly string[]).includes(referralVal)
          || extraReferrals.some((option) => option.label === referralVal);
        const isNameReferral = referralNeedsName(referralVal);
        setEditingInitial({
          id: editingId,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          password: '',
          phone: data.phone ?? '',
          referral: isNameReferral || (isKnownReferral && referralVal !== 'Other')
            ? referralVal
            : (referralVal ? 'Other' : ''),
          referralOther: isNameReferral ? savedName : (referralVal === 'Other' ? savedName : (isKnownReferral ? '' : referralVal)),
          userPicture: data.userPicture ?? '',
          addressSearch: data.streetAddress ?? '',
          streetAddress: data.streetAddress ?? '',
          apartment: data.apartment ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zipCode: data.zipCode ?? '',
        });
      })
      .catch(() => {
        if (!cancelled) setEditingInitial({ ...emptyForm, id: editingId });
      });
    return () => { cancelled = true; };
  }, [viewMode, editingId, extraReferrals]);

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
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
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

  const handleBulkDelete = (ids: string[]) => setBulkDeleteIds(ids);
  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteIds?.length) return;
    setDeleting(true);
    setError(null);
    try {
      for (const id of bulkDeleteIds) {
        const res = await fetch(`/api/admin/customers/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
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

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Customers</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="md:hidden">Manage customers.</span>
                <span className="hidden md:inline">Manage customers accounts and view contact details.</span>
              </p>
            </div>
            <div className="md:hidden h-9 px-4 rounded-md border-2 border-black bg-white flex items-center justify-center shrink-0 text-sm font-medium text-black">
              {total} customer{total !== 1 ? 's' : ''}
            </div>
            <Button
              variant="primary"
              size="sm"
              className="hidden md:flex items-center gap-2 shrink-0"
              onClick={() => setViewMode('add')}
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </div>
          <AdminFloatingAddButton onClick={() => setViewMode('add')} ariaLabel="Add customer" />
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-2xl md:mx-auto">
          <div className="py-2 md:py-0 md:mb-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setViewMode('table');
                setEditingId(null);
                setEditingInitial(null);
              }}
              className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer"
              aria-label="Back to customers"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline">Back</span>
            </button>
            <span className="text-lg md:text-xl font-semibold text-gray-900">
              {viewMode === 'add' ? 'Add Customer' : 'Edit User'}
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
            <>
              {editingInitial ? (
                <CustomerForm
                  mode="edit"
                  initial={editingInitial}
                  onCancel={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); }}
                  onSuccess={() => { setViewMode('table'); setEditingId(null); setEditingInitial(null); fetchCustomers(); }}
                />
              ) : (
                <div className="p-12 text-center text-gray-500 text-sm">Loading customer…</div>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'table' && <ReferralOptionsEditor />}

      {viewMode === 'table' && (
        <AdminDataTable
          columnOrderKey="admin-customers"
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
          onSearchInput={setSearchInput}
          onSearchSubmit={handleSearchSubmit}
          searchPlaceholder="Search by name, city, state…"
          isLoading={isLoading}
          isRefetching={isRefetching}
          hasLoadedOnce={hasLoadedOnce}
          error={error}
          getRowId={(row) => row.id}
          getCellText={customerCellText}
          renderCell={(row, columnId) => customerCellText(row, columnId) || '—'}
          onRowClick={(row) => {
            setEditingId(row.id);
            setViewMode('edit');
          }}
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
                const left = Math.min(rect.right - 120, window.innerWidth - 130);
                const spaceBelow = window.innerHeight - rect.bottom - 4;
                const top = spaceBelow >= MENU_HEIGHT ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4;
                setMenuPosition({ top, left });
                setOpenActionsId(row.id);
              }}
              className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
              aria-label="Actions"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          )}
          bulkActions={{
            onDelete: handleBulkDelete,
            onCopyAsJson: (rows) => {
              void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
            },
            onEdit: (row) => {
              setEditingId(row.id);
              setViewMode('edit');
            },
          }}
          emptyMessage="No customers found."
          itemLabel="customers"
          primaryColumnId="name"
        />
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setBulkDeleteIds(null)}
          showHeader={false}
          showCloseButton={true}
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete customers?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{bulkDeleteIds.length}</strong> customer
              {bulkDeleteIds.length !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setBulkDeleteIds(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={handleBulkDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length} customer${bulkDeleteIds.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete customer warning modal */}
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
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

      {/* Actions dropdown portal so it is not clipped by table overflow */}
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
                if (row) {
                  setEditingId(row.id);
                  setViewMode('edit');
                }
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
                  setDeleteConfirm({
                    id: row.id,
                    firstName: row.first_name,
                    lastName: row.last_name,
                  });
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
    </div>
  );
}
