'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Accordion from '@/components/ui/Accordion';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import Modal from '@/components/ui/Modal';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import type { Database } from '@/lib/types/supabase';

type CRMCustomerRow = Database['public']['Tables']['pro_crm_customers']['Row'];

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Joined' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'last_name', label: 'Last name' },
  { value: 'first_name', label: 'First name' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
  email: string;
  phone: string;
  note: string;
  addressSearch: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
};

const emptyForm: CRMCustomerFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  note: '',
  addressSearch: '',
  streetAddress: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
};

type AccordionKey = 'contact' | 'address';

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
  const [accordionOpen, setAccordionOpen] = useState<Record<AccordionKey, boolean>>({ contact: true, address: false });

  const update = (key: keyof CRMCustomerFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };
  const toggleAccordion = (key: AccordionKey) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const id = (initial as { id?: string }).id;
      const url = id ? `/api/crm/customers/${id}` : '/api/crm/customers';
      const method = id ? 'PUT' : 'POST';
      const body = id
        ? {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            note: form.note.trim() || null,
            streetAddress: form.streetAddress.trim() || null,
            apartment: form.apartment.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            zipCode: form.zipCode.trim() || null,
          }
        : {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            note: form.note.trim() || null,
            streetAddress: form.streetAddress.trim() || null,
            apartment: form.apartment.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            zipCode: form.zipCode.trim() || null,
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
    <form onSubmit={handleSubmit} className="md:p-6 space-y-4 max-w-xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}
      <Accordion title="Contact" isOpen={accordionOpen.contact} onToggle={() => toggleAccordion('contact')} required>
        <div className="space-y-4">
          <FormField label="First name" required>
            <Input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="First name" required />
          </FormField>
          <FormField label="Last name" required>
            <Input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="Last name" required />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@example.com" />
          </FormField>
          <FormField label="Phone">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', formatPhoneNumber(e.target.value))}
              placeholder="(702) 555-0123"
            />
          </FormField>
          <FormField label="Note">
            <Input value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Optional note" />
          </FormField>
        </div>
      </Accordion>
      <Accordion title="Address" isOpen={accordionOpen.address} onToggle={() => toggleAccordion('address')}>
        <div className="space-y-4">
          <FormField label="Search address">
            <AddressAutocomplete
              value={form.addressSearch}
              onChange={(v) => update('addressSearch', v)}
              onAddressSelect={(addr: AddressData) => {
                setForm((prev) => ({
                  ...prev,
                  addressSearch: addr.streetAddress || addr.fullAddress || '',
                  streetAddress: addr.streetAddress || prev.streetAddress,
                  apartment: addr.apartment ?? prev.apartment,
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
            <Input value={form.apartment} onChange={(e) => update('apartment', e.target.value)} placeholder="Apt, suite, etc." />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="City">
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="City" />
            </FormField>
            <FormField label="State">
              <Input value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="e.g. NV" maxLength={2} />
            </FormField>
          </div>
          <FormField label="ZIP code">
            <Input value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} placeholder="ZIP" />
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
        setEditingInitial({
          id: editingId,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          note: data.note ?? '',
          addressSearch: data.streetAddress ?? '',
          streetAddress: data.streetAddress ?? '',
          apartment: data.apartment ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zipCode: data.zipCode ?? '',
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
          <div className="md:hidden mt-2 flex justify-end">
            <Button variant="primary" size="sm" className="flex md:hidden items-center gap-2" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </div>
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-2xl md:mx-auto">
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
                <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: 500 }}>
                  <thead>
                    <tr className="border-b-2 border-black bg-black text-white">
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Name" sortKey="last_name" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Email" sortKey="email" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Phone" sortKey="phone" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Location" sortKey="city" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Joined" sortKey="created_at" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="sticky right-0 z-10 py-1.5 text-center bg-black border-l-2 border-white w-[72px]">
                        <span className="font-semibold text-white whitespace-nowrap">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
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
                          <td className="px-4 py-1.5 max-w-0 overflow-hidden">
                            <span className="font-medium text-gray-900 truncate block">
                              {row.first_name || ''} {row.last_name || ''}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-gray-600 max-w-0 overflow-hidden">
                            <span className="truncate block">{row.email || '—'}</span>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-gray-600 max-w-0 overflow-hidden">
                            <span className="truncate block">{row.phone || '—'}</span>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-gray-600 max-w-0 overflow-hidden">
                            <span className="truncate block">
                              {[row.city, row.state].filter(Boolean).length ? [row.city, row.state].filter(Boolean).join(', ') : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-gray-500 max-w-0 overflow-hidden">
                            <span className="truncate block">{formatDate(row.created_at)}</span>
                          </td>
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
    </div>
  );
}
