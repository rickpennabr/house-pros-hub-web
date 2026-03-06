'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'status', label: 'Status' },
  { value: 'due_date', label: 'Due date' },
  { value: 'amount_cents', label: 'Amount' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined'] as const;

interface EstimateRow {
  id: string;
  customer_id: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
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
      <button type="button" onClick={() => setOpen((o) => !o)} className="p-0.5 rounded hover:bg-white/20 text-white cursor-pointer" aria-label="Sort">
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg text-black">
          <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 cursor-pointer" onClick={() => { onSort(sortKey, 'asc'); setOpen(false); }}>Ascending</button>
          <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 cursor-pointer" onClick={() => { onSort(sortKey, 'desc'); setOpen(false); }}>Descending</button>
        </div>
      )}
    </div>
  );
}

interface CustomerOption {
  id: string;
  first_name: string;
  last_name: string;
}

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMEstimatesPage() {
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    customerId: string;
    amountCents: number;
    status: string;
    dueDate: string;
    note: string;
  } | null>(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formAmountDollars, setFormAmountDollars] = useState('');
  const [formStatus, setFormStatus] = useState('draft');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchEstimates = useCallback(async () => {
    const isFirst = !hasLoadedOnceRef.current;
    try {
      if (isFirst) setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/crm/estimates?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEstimates(data.estimates ?? []);
      setTotal(data.total ?? 0);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
      if (isFirst) { setEstimates([]); setTotal(0); }
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortDir, statusFilter]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  useEffect(() => {
    if (viewMode === 'add' || viewMode === 'edit') {
      fetch('/api/crm/customers?pageSize=500', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setCustomers(d.customers ?? []))
        .catch(() => setCustomers([]));
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'edit' || !editingId) return;
    let cancelled = false;
    setEditingData(null);
    fetch(`/api/crm/estimates/${editingId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEditingData({
          customerId: data.customerId ?? '',
          amountCents: data.amountCents ?? 0,
          status: data.status ?? 'draft',
          dueDate: data.dueDate ? data.dueDate.slice(0, 10) : '',
          note: data.note ?? '',
        });
        setFormCustomerId(data.customerId ?? '');
        setFormAmountDollars(data.amountCents != null ? (data.amountCents / 100).toFixed(2) : '');
        setFormStatus(data.status ?? 'draft');
        setFormDueDate(data.dueDate ? data.dueDate.slice(0, 10) : '');
        setFormNote(data.note ?? '');
      })
      .catch(() => { if (!cancelled) setEditingData({ customerId: '', amountCents: 0, status: 'draft', dueDate: '', note: '' }); });
    return () => { cancelled = true; };
  }, [viewMode, editingId]);

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

  const handleSort = (key: SortKey, dir: 'asc' | 'desc') => { setSortBy(key); setSortDir(dir); setPage(1); };
  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/estimates/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchEstimates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estimate');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formCustomerId) { setFormError('Select a customer'); return; }
    const amountCents = Math.round(parseFloat(formAmountDollars || '0') * 100);
    setSaving(true);
    try {
      const res = await fetch('/api/crm/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId,
          amountCents,
          status: formStatus,
          dueDate: formDueDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create estimate');
      setViewMode('table');
      setFormCustomerId('');
      setFormAmountDollars('');
      setFormStatus('draft');
      setFormDueDate('');
      setFormNote('');
      fetchEstimates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setFormError(null);
    const amountCents = Math.round(parseFloat(formAmountDollars || '0') * 100);
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/estimates/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId || undefined,
          amountCents,
          status: formStatus,
          dueDate: formDueDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update estimate');
      setViewMode('table');
      setEditingId(null);
      setEditingData(null);
      fetchEstimates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Estimates</h1>
              <p className="text-sm text-gray-500 mt-0.5">Create and track quotes for customers.</p>
            </div>
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Estimate
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 pb-2">
            <form className="flex gap-2 items-center" onSubmit={(e) => e.preventDefault()}>
              <label className="text-sm text-gray-600">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 border border-gray-300 rounded-md text-sm bg-white text-black"
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </form>
          </div>
          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            {isLoading && !hasLoadedOnce ? (
              <div className="p-12 text-center text-gray-500 text-sm">Loading estimates…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 500 }}>
                  <thead>
                    <tr className="border-b-2 border-black bg-black text-white">
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Customer" sortKey="created_at" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Amount" sortKey="amount_cents" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Status" sortKey="status" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                        <SortHeader label="Due" sortKey="due_date" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="sticky right-0 z-10 py-1.5 text-center bg-black border-l-2 border-white w-[72px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">No estimates found.</td></tr>
                    ) : (
                      estimates.map((row) => (
                        <tr
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { setEditingId(row.id); setViewMode('edit'); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingId(row.id); setViewMode('edit'); } }}
                          className="group border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                        >
                          <td className="px-4 py-1.5 font-medium text-gray-900">
                            {[row.customerFirstName, row.customerLastName].filter(Boolean).join(' ') || '—'}
                          </td>
                          <td className="px-4 py-1.5 text-sm text-gray-600">{formatAmount(row.amount_cents)}</td>
                          <td className="px-4 py-1.5 text-sm text-gray-600">{row.status}</td>
                          <td className="px-4 py-1.5 text-sm text-gray-500">{formatDate(row.due_date)}</td>
                          <td className="sticky right-0 z-10 py-1.5 text-center bg-white group-hover:bg-gray-50/80 border-l-2 border-gray-100" onClick={(e) => e.stopPropagation()}>
                            <button
                              ref={openActionsId === row.id ? actionsButtonRef : undefined}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openActionsId === row.id) { setOpenActionsId(null); setMenuPosition(null); return; }
                                const rect = e.currentTarget.getBoundingClientRect();
                                actionsButtonRef.current = e.currentTarget;
                                setMenuPosition({ top: rect.bottom + 4, left: Math.min(rect.right - 120, window.innerWidth - 130) });
                                setOpenActionsId(row.id);
                              }}
                              className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                              aria-label="Actions"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
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
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={PAGE_SIZE} itemLabel="estimates" />
            </div>
          )}
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-xl md:mx-auto">
          <div className="py-2 md:mb-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => { setViewMode('table'); setEditingId(null); setEditingData(null); }}
              className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              Back
            </button>
            <span className="text-lg font-semibold text-gray-900">{viewMode === 'add' ? 'New Estimate' : 'Edit Estimate'}</span>
          </div>
          {(viewMode === 'add' || editingData !== null) && (
            <form onSubmit={viewMode === 'add' ? handleSubmitAdd : handleSubmitEdit} className="space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{formError}</div>}
              <FormField label="Customer" required>
                <Select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} required disabled={viewMode === 'edit'}>
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Amount ($)">
                <Input type="number" step="0.01" min="0" value={formAmountDollars} onChange={(e) => setFormAmountDollars(e.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Status">
                <Select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
              <FormField label="Due date">
                <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
              </FormField>
              <FormField label="Note">
                <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional note" />
              </FormField>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => { setViewMode('table'); setEditingId(null); setEditingData(null); }} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? 'Saving…' : viewMode === 'add' ? 'Create Estimate' : 'Save changes'}</Button>
              </div>
            </form>
          )}
          {viewMode === 'edit' && editingData === null && <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>}
        </div>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete estimate?</h2>
            <p className="text-gray-600 mb-6">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div ref={actionsMenuRef} className="fixed z-[100] min-w-[120px] py-1 bg-white border border-gray-200 rounded-md shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(openActionsId); setViewMode('edit'); setOpenActionsId(null); setMenuPosition(null); }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { const r = estimates.find((e) => e.id === openActionsId); if (r) setDeleteConfirm({ id: r.id, label: `${r.customerFirstName} ${r.customerLastName}` }); setOpenActionsId(null); setMenuPosition(null); }}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
