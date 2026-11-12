'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Plus, Pencil, Trash2, ArrowLeft, AlertTriangle, Filter, LayoutGrid, Calendar, Play, Pause, CircleCheck, Ban } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';
import { CrmRowActionsButton, CrmRowActionsPortal, useCrmRowActions } from '@/components/crm/CrmRowActionsMenu';
import { CRM_LIST_PAGE_SIZE, useCrmListQuery } from '@/hooks/useCrmListQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import { contactDisplayName, listedCustomerName } from '@/lib/crm/contact-name';
import Modal from '@/components/ui/Modal';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'start_date', label: 'Start' },
  { value: 'end_date', label: 'End' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const STATUS_OPTIONS = ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;

const STATUS_FILTER_ICONS = {
  planned: Calendar,
  in_progress: Play,
  on_hold: Pause,
  completed: CircleCheck,
  cancelled: Ban,
} as const;

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface ProjectRow {
  id: string;
  customer_id: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerDisplayName?: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  /** Linked estimate total. Null when the project has no estimate. */
  contract_amount_cents: number | null;
  /** Sum of expenses linked to this project. */
  project_cost_cents: number;
  customerAddress?: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Contract minus cost. Null when there is no contract to measure against. */
function profitCents(row: ProjectRow): number | null {
  if (row.contract_amount_cents == null) return null;
  return row.contract_amount_cents - row.project_cost_cents;
}

/** Profit as a percent of the contract. Null when the contract is missing or zero. */
function profitPercent(row: ProjectRow): number | null {
  if (row.contract_amount_cents == null || row.contract_amount_cents <= 0) return null;
  return ((row.contract_amount_cents - row.project_cost_cents) / row.contract_amount_cents) * 100;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

const PROJECT_COLUMNS: AdminDataTableColumn<ProjectRow>[] = [
  { id: 'name', label: 'Project', sortKey: 'name', width: 200 },
  { id: 'customer', label: 'Customer', width: 180 },
  { id: 'status', label: 'Status', sortKey: 'status', width: 130 },
  { id: 'start_date', label: 'Start', sortKey: 'start_date', width: 130 },
  { id: 'end_date', label: 'End', sortKey: 'end_date', width: 130 },
  { id: 'contract_amount', label: 'Contract Amount', width: 150 },
  { id: 'project_cost', label: 'Project Cost', width: 140 },
  { id: 'profit', label: 'Profit', width: 130 },
  { id: 'profit_percent', label: 'Profit %', width: 110 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function projectCellText(row: ProjectRow, columnId: string): string {
  switch (columnId) {
    case 'name':
      return row.name;
    case 'customer':
      return listedCustomerName(row);
    case 'status':
      return row.status;
    case 'start_date':
      return row.start_date ? formatDate(row.start_date) : '';
    case 'end_date':
      return row.end_date ? formatDate(row.end_date) : '';
    case 'contract_amount':
      return row.contract_amount_cents == null ? '' : formatMoney(row.contract_amount_cents);
    case 'project_cost':
      return formatMoney(row.project_cost_cents ?? 0);
    case 'profit': {
      const profit = profitCents(row);
      return profit == null ? '' : formatMoney(profit);
    }
    case 'profit_percent': {
      const percent = profitPercent(row);
      return percent == null ? '' : formatPercent(percent);
    }
    default:
      return '';
  }
}

function profitTone(cents: number | null): string {
  if (cents == null || cents === 0) return 'text-gray-900';
  return cents > 0 ? 'text-green-700' : 'text-red-600';
}

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMProjectsPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedListView, setSavedListView] = useLocalStorage<string>('crmProjectsView', 'list');
  const listView: ViewType = savedListView === 'map' ? 'map' : 'list';
  const crmChrome = useCRMChrome();
  const {
    rows: projects,
    total,
    page,
    setPage,
    sortBy,
    sortDir,
    searchInput,
    isLoading,
    error,
    setError,
    hasLoadedOnce,
    reload: fetchProjects,
    handleSort,
    handleSearchInput,
    handleSearchSubmit,
  } = useCrmListQuery<ProjectRow>({
    endpoint: '/api/crm/projects',
    rowsKey: 'projects',
    defaultSort: 'created_at',
    extraParams: { status: statusFilter },
    loadError: 'Failed to load projects',
  });
  const rowActions = useCrmRowActions();

  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string; display_name?: string | null; company_name?: string | null }[]>([]);
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
  const prefillsAppliedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('customerId') || searchParams.get('new') === '1') {
      setViewMode('add');
    }
  }, [searchParams]);

  useEffect(() => {
    if (viewMode === 'add' || viewMode === 'edit') {
      Promise.all([
        fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' }).then((r) => r.json()),
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

  const applyStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    setFiltersOpen(false);
  };
  const statusFilterButton = !crmChrome?.searchOpen ? (
    <button
      type="button"
      onClick={() => setFiltersOpen(true)}
      className="relative h-11 w-11 shrink-0 rounded-lg border-2 border-black bg-black flex items-center justify-center cursor-pointer hover:bg-gray-800 md:hidden"
      aria-label="Filter"
    >
      <Filter className="w-5 h-5 text-white" />
      {statusFilter ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
    </button>
  ) : null;

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="hidden md:flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Projects</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track jobs and link them to customers and estimates.</p>
            </div>
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
          <div className="hidden md:flex flex-wrap items-center gap-4 pb-2">
            <label className="text-sm text-gray-600">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 px-3 border border-gray-300 rounded-md text-sm bg-white text-black">
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <MobileGridActionsModal
            isOpen={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title="Filter by status"
            items={[
              {
                id: 'all',
                label: 'All',
                icon: LayoutGrid,
                isActive: statusFilter === '',
                onClick: () => applyStatusFilter(''),
              },
              ...STATUS_OPTIONS.map((option) => ({
                id: option,
                label: statusLabel(option),
                icon: STATUS_FILTER_ICONS[option],
                isActive: statusFilter === option,
                onClick: () => applyStatusFilter(option),
              })),
            ]}
          />
          <AdminDataTable
            searchRowClassName="max-md:pt-2"
            searchEndAction={statusFilterButton}
            hideBody={listView === 'map'}
            columnOrderKey="crm-projects"
            exportName="projects"
            columns={PROJECT_COLUMNS}
            data={projects}
            total={total}
            page={page}
            pageSize={CRM_LIST_PAGE_SIZE}
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
            renderCell={(row, columnId) => {
              if (columnId === 'profit' || columnId === 'profit_percent') {
                const text = projectCellText(row, columnId);
                if (!text) return '—';
                return <span className={`tabular-nums font-medium ${profitTone(profitCents(row))}`}>{text}</span>;
              }
              if (columnId === 'contract_amount' || columnId === 'project_cost') {
                const text = projectCellText(row, columnId);
                return text ? <span className="tabular-nums">{text}</span> : '—';
              }
              return projectCellText(row, columnId) || '—';
            }}
            onRowClick={(row) => { setEditingId(row.id); setViewMode('edit'); }}
            renderActions={(row) => (
              <CrmRowActionsButton rowId={row.id} openId={rowActions.openId} onToggle={rowActions.toggle} />
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
          {listView === 'map' && (
            <AddressPinsMap
              pins={projects.map((row) => ({
                id: row.id,
                title: row.name,
                detail: `${listedCustomerName(row) || 'Project'} · ${statusLabel(row.status)}`,
                address: row.customerAddress || '',
              }))}
              onOpen={(id) => { setEditingId(id); setViewMode('edit'); }}
            />
          )}
          {listView === 'map' && !isLoading && total > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / CRM_LIST_PAGE_SIZE))}
                onPageChange={setPage}
                totalItems={total}
                itemsPerPage={CRM_LIST_PAGE_SIZE}
                itemLabel="projects"
              />
            </div>
          )}
          {!isLoading && (
            <ViewToggle
              currentView={listView}
              onViewChange={setSavedListView}
              views={['list', 'map']}
              hideBackgroundToggle
              onAdd={() => setViewMode('add')}
              addLabel="New project"
            />
          )}
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
                {customers.map((c) => <option key={c.id} value={c.id}>{contactDisplayName(c)}</option>)}
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

      <CrmRowActionsPortal openId={rowActions.openId} position={rowActions.position} menuRef={rowActions.menuRef}>
        <Link href={`/${locale}/crm/projects/${rowActions.openId}/photos`} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={rowActions.close}>Photos</Link>
        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(rowActions.openId); setViewMode('edit'); rowActions.close(); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
        <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { if (rowActions.openId) setDeleteConfirm({ id: rowActions.openId }); rowActions.close(); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </CrmRowActionsPortal>
    </div>
  );
}
