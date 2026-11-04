'use client';

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'start_date', label: 'Start' },
  { value: 'end_date', label: 'End' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const STATUS_OPTIONS = ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;

interface ProjectRow {
  id: string;
  customer_id: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const PROJECT_COLUMNS: AdminDataTableColumn<ProjectRow>[] = [
  { id: 'name', label: 'Project', sortKey: 'name', width: 200 },
  { id: 'customer', label: 'Customer', width: 180 },
  { id: 'status', label: 'Status', sortKey: 'status', width: 130 },
  { id: 'start_date', label: 'Start', sortKey: 'start_date', width: 130 },
  { id: 'end_date', label: 'End', sortKey: 'end_date', width: 130 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function projectCellText(row: ProjectRow, columnId: string): string {
  switch (columnId) {
    case 'name':
      return row.name;
    case 'customer':
      return [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ');
    case 'status':
      return row.status;
    case 'start_date':
      return row.start_date ? formatDate(row.start_date) : '';
    case 'end_date':
      return row.end_date ? formatDate(row.end_date) : '';
    default:
      return '';
  }
}

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMProjectsPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const crmChrome = useCRMChrome();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [estimates, setEstimates] = useState<{ id: string; customer_id: string; amount_cents: number }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formEstimateId, setFormEstimateId] = useState('');
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState('planned');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const prefillsAppliedRef = useRef(false);

  const fetchProjects = useCallback(async () => {
    const isFirst = !hasLoadedOnceRef.current;
    try {
      if (isFirst) setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/crm/projects?${params}`, { credentials: 'include' });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      if (isFirst) { setProjects([]); setTotal(0); }
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortDir, statusFilter, search]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    const requestedCustomerId = searchParams.get('customerId');
    if (!requestedCustomerId) return;
    setViewMode('add');
  }, [searchParams]);

  useEffect(() => {
    if (viewMode === 'add' || viewMode === 'edit') {
      Promise.all([
        fetch('/api/crm/customers?pageSize=500', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/crm/estimates?pageSize=500', { credentials: 'include' }).then((r) => r.json()),
      ]).then(([cData, eData]) => {
        setCustomers(cData.customers ?? []);
        setEstimates(eData.estimates ?? []);
      }).catch(() => { setCustomers([]); setEstimates([]); });
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'add') return;
    if (prefillsAppliedRef.current) return;
    if (customers.length === 0) return;
    const requestedCustomerId = searchParams.get('customerId');
    if (requestedCustomerId && customers.some((customer) => customer.id === requestedCustomerId)) {
      setFormCustomerId(requestedCustomerId);
    }
    prefillsAppliedRef.current = true;
  }, [customers, searchParams, viewMode]);

  useEffect(() => {
    if (viewMode !== 'edit' || !editingId) return;
    let cancelled = false;
    fetch(`/api/crm/projects/${editingId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setFormCustomerId(data.customerId ?? '');
        setFormEstimateId(data.estimateId ?? '');
        setFormName(data.name ?? '');
        setFormStatus(data.status ?? 'planned');
        setFormStartDate(data.startDate ? data.startDate.slice(0, 10) : '');
        setFormEndDate(data.endDate ? data.endDate.slice(0, 10) : '');
        setFormNote(data.note ?? '');
      })
      .catch(() => { if (!cancelled) setFormName(''); });
    return () => { cancelled = true; };
  }, [viewMode, editingId]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!actionsMenuRef.current?.contains(target) && !actionsButtonRef.current?.contains(target)) { setOpenActionsId(null); setMenuPosition(null); }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionsId]);

  const handleSort = (key: SortKey, dir: 'asc' | 'desc') => { setSortBy(key); setSortDir(dir); setPage(1); };
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 200);
  };
  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    setSearch(searchInput.trim());
    setPage(1);
  };
  useEffect(() => () => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
  }, []);
  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/projects/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
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
        const res = await fetch(`/api/crm/projects/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
      }
      setBulkDeleteIds(null);
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete projects');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formCustomerId || !formName.trim()) { setFormError('Customer and project name are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId,
          estimateId: formEstimateId || null,
          name: formName.trim(),
          status: formStatus,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create project');
      setViewMode('table');
      setFormCustomerId(''); setFormEstimateId(''); setFormName(''); setFormStatus('planned'); setFormStartDate(''); setFormEndDate(''); setFormNote('');
      fetchProjects();
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
    if (!formName.trim()) { setFormError('Project name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/projects/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId || undefined,
          estimateId: formEstimateId || null,
          name: formName.trim(),
          status: formStatus,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update project');
      setViewMode('table');
      setEditingId(null);
      fetchProjects();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const estimatesForCustomer = formCustomerId ? estimates.filter((e) => e.customer_id === formCustomerId) : [];

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Projects</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track jobs and link them to customers and estimates.</p>
            </div>
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
          <div className={`flex flex-wrap items-center gap-4 pb-2 ${crmChrome?.searchOpen ? 'max-md:hidden' : ''}`}>
            <label className="text-sm text-gray-600">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 px-3 border border-gray-300 rounded-md text-sm bg-white text-black">
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <AdminDataTable
            columnOrderKey="crm-projects"
            exportName="projects"
            columns={PROJECT_COLUMNS}
            data={projects}
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
            searchPlaceholder="Search project or customer…"
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            error={error}
            getRowId={(row) => row.id}
            getCellText={projectCellText}
            renderCell={(row, columnId) => projectCellText(row, columnId) || '—'}
            onRowClick={(row) => { setEditingId(row.id); setViewMode('edit'); }}
            renderActions={(row) => (
              <button
                ref={openActionsId === row.id ? actionsButtonRef : undefined}
                type="button"
                onClick={(e) => { e.stopPropagation(); if (openActionsId === row.id) { setOpenActionsId(null); setMenuPosition(null); return; } const rect = e.currentTarget.getBoundingClientRect(); actionsButtonRef.current = e.currentTarget; setMenuPosition({ top: rect.bottom + 4, left: Math.min(rect.right - 120, window.innerWidth - 130) }); setOpenActionsId(row.id); }}
                className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                aria-label="Actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            )}
            bulkActions={{
              onDelete: (ids) => setBulkDeleteIds(ids),
              onCopyAsJson: (rows) => { void navigator.clipboard.writeText(JSON.stringify(rows, null, 2)); },
              onEdit: (row) => { setEditingId(row.id); setViewMode('edit'); },
            }}
            emptyMessage="No projects found."
            itemLabel="projects"
            primaryColumnId="name"
          />
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-xl md:mx-auto">
          <div className="py-2 md:mb-6 flex items-center justify-between gap-4">
            <button type="button" onClick={() => { setViewMode('table'); setEditingId(null); }} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer">
              <ArrowLeft className="w-5 h-5 shrink-0" /> Back
            </button>
            <span className="text-lg font-semibold text-gray-900">{viewMode === 'add' ? 'New Project' : 'Edit Project'}</span>
          </div>
          <form onSubmit={viewMode === 'add' ? handleSubmitAdd : handleSubmitEdit} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{formError}</div>}
            <FormField label="Customer" required>
              <Select value={formCustomerId} onChange={(e) => { setFormCustomerId(e.target.value); setFormEstimateId(''); }} required disabled={viewMode === 'edit'}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Estimate (optional)">
              <Select value={formEstimateId} onChange={(e) => setFormEstimateId(e.target.value)}>
                <option value="">None</option>
                {estimatesForCustomer.map((est) => <option key={est.id} value={est.id}>Estimate ${(est.amount_cents / 100).toFixed(2)}</option>)}
              </Select>
            </FormField>
            <FormField label="Project name" required>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Kitchen remodel" required />
            </FormField>
            <FormField label="Status">
              <Select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </Select>
            </FormField>
            <FormField label="Start date">
              <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
            </FormField>
            <FormField label="Note">
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional note" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => { setViewMode('table'); setEditingId(null); }} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? 'Saving…' : viewMode === 'add' ? 'Create Project' : 'Save changes'}</Button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete project?</h2>
            <p className="text-gray-600 mb-6">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal isOpen onClose={() => !deleting && setBulkDeleteIds(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete projects?</h2>
            <p className="text-gray-600 mb-6">Delete {bulkDeleteIds.length} project{bulkDeleteIds.length === 1 ? '' : 's'}? This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setBulkDeleteIds(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void handleBulkDeleteConfirm()} disabled={deleting}>{deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length}`}</Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div ref={actionsMenuRef} className="fixed z-[100] min-w-[120px] py-1 bg-white border border-gray-200 rounded-md shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <Link href={`/${locale}/crm/projects/${openActionsId}/photos`} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setOpenActionsId(null); setMenuPosition(null); }}>Photos</Link>
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(openActionsId); setViewMode('edit'); setOpenActionsId(null); setMenuPosition(null); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setDeleteConfirm({ id: openActionsId }); setOpenActionsId(null); setMenuPosition(null); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </div>,
          document.body
        )}
    </div>
  );
}
