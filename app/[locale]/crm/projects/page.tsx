'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CrmStatCards, type CrmStatCard } from '@/components/crm/CrmStatCards';
import type { ProjectSummary } from '@/lib/crm/list-summaries';
import { projectDurationText } from '@/lib/crm/project-duration';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ChartLoading, ProjectListChart } from '@/components/crm/ListCharts';
import { isProjectChart } from '@/lib/crm/list-charts';
import { TitleCount } from '@/components/crm/TitleCount';
import { PickerSelect } from '@/components/ui/PickerSelect';

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
  display_id?: string | null;
  invoiced_cents?: number;
  collected_cents?: number;
  balance_cents?: number;
  labor_hours?: number;
  project_manager?: string | null;
  city?: string | null;
}

/** "5 days left", "3 days late", "Starts in 2 days", or done. */
function scheduleText(row: ProjectRow): string {
  if (row.status === 'completed') return 'Done';
  if (row.status === 'cancelled') return '';
  const today = new Date();
  const dayMs = 86_400_000;
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (iso: string) => Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - startOfToday) / dayMs);
  if (row.status === 'planned' && row.start_date && days(row.start_date) > 0) {
    const n = days(row.start_date);
    return `Starts in ${n} day${n === 1 ? '' : 's'}`;
  }
  if (!row.end_date) return '';
  const left = days(row.end_date);
  if (left === 0) return 'Due today';
  return left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : `${-left} day${left === -1 ? '' : 's'} late`;
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
  { id: 'display_id', label: 'No.', width: 100 },
  { id: 'name', label: 'Project', sortKey: 'name', width: 200 },
  { id: 'customer', label: 'Customer', width: 180 },
  { id: 'city', label: 'City', width: 130 },
  { id: 'project_manager', label: 'Project Manager', width: 160 },
  { id: 'status', label: 'Status', sortKey: 'status', width: 130 },
  { id: 'start_date', label: 'Start', sortKey: 'start_date', width: 130 },
  { id: 'end_date', label: 'End', sortKey: 'end_date', width: 130 },
  { id: 'duration', label: 'Duration', width: 120 },
  { id: 'schedule', label: 'Schedule', width: 130 },
  { id: 'contract_amount', label: 'Contract Amount', width: 150 },
  { id: 'project_cost', label: 'Project Cost', width: 140 },
  { id: 'profit', label: 'Profit', width: 130 },
  { id: 'profit_percent', label: 'Profit %', width: 110 },
  { id: 'invoiced', label: 'Invoiced', width: 130 },
  { id: 'billed_percent', label: '% Billed', width: 100 },
  { id: 'collected', label: 'Collected', width: 130 },
  { id: 'balance', label: 'Balance Due', width: 130 },
  { id: 'labor_hours', label: 'Labor Hours', width: 110 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function projectCellText(row: ProjectRow, columnId: string): string {
  switch (columnId) {
    case 'display_id':
      return row.display_id ?? '';
    case 'name':
      return row.name;
    case 'city':
      return row.city ?? '';
    case 'project_manager':
      return row.project_manager ?? '';
    case 'schedule':
      return scheduleText(row);
    case 'duration':
      return projectDurationText(row.start_date, row.end_date);
    case 'invoiced':
      return formatMoney(row.invoiced_cents ?? 0);
    case 'billed_percent':
      return row.contract_amount_cents && row.contract_amount_cents > 0
        ? formatPercent(((row.invoiced_cents ?? 0) / row.contract_amount_cents) * 100)
        : '';
    case 'collected':
      return formatMoney(row.collected_cents ?? 0);
    case 'balance':
      return formatMoney(row.balance_cents ?? 0);
    case 'labor_hours':
      return row.labor_hours ? `${row.labor_hours} h` : '';
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
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedListView, setSavedListView] = useLocalStorage<string>('crmProjectsView', 'table');
  const listView: ViewType = savedListView === 'map' || savedListView === 'chart' ? savedListView : 'table';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
    chart,
    search,
    statusSummary,
  } = useCrmListQuery<ProjectRow>({
    endpoint: '/api/crm/projects',
    rowsKey: 'projects',
    defaultSort: 'created_at',
    extraParams: {
      status: statusFilter,
      ...(listView === 'chart' ? { chart: '1', timeZone } : {}),
    },
    loadError: 'Failed to load projects',
  });
  const rowActions = useCrmRowActions();
  const projectCards = useMemo<CrmStatCard[]>(() => {
    const sum = statusSummary as ProjectSummary | null;
    if (!sum) return [];
    const n = (count: number) => `${count} ${count === 1 ? 'project' : 'projects'}`;
    const day = (iso: string | null, prefix: string) =>
      iso ? `${prefix} ${new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '—';
    return [
      { key: 'planned', label: 'Coming up', value: n(sum.planned.count), sub: day(sum.planned.next, 'Next starts') },
      { key: 'in_progress', label: 'In progress', value: n(sum.in_progress.count), sub: day(sum.in_progress.next, 'Next finish') },
      { key: 'on_hold', label: 'On hold', value: n(sum.on_hold.count), sub: sum.on_hold.count ? 'Waiting' : '—', alert: sum.on_hold.count > 0 },
      { key: 'completed', label: 'Completed', value: n(sum.completed.count), sub: 'All time' },
    ];
  }, [statusSummary]);

  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string; display_name?: string | null; company_name?: string | null }[]>([]);
  const [estimates, setEstimates] = useState<{ id: string; customer_id: string; amount_cents: number }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  /** The record whose data is in the edit form. Until it matches editingId, show a placeholder, not empty fields. */
  const [editLoadedId, setEditLoadedId] = useState<string | null>(null);
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

  // Came from a project's page: edit it, then go back there.
  const editParam = searchParams.get('edit');
  useEffect(() => {
    if (searchParams.get('customerId') || searchParams.get('new') === '1') {
      setViewMode('add');
    }
    if (editParam) {
      setEditingId(editParam);
      setViewMode('edit');
    }
  }, [searchParams, editParam]);
  const closeForm = () => {
    if (editParam) {
      router.push(`/${locale}/crm/projects/${editParam}`);
      return;
    }
    setViewMode('table');
    setEditingId(null);
  };

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
        setEditLoadedId(editingId);
        setFormCustomerId(data.customerId ?? '');
        setFormEstimateId(data.estimateId ?? '');
        setFormName(data.name ?? '');
        setFormStatus(data.status ?? 'planned');
        setFormStartDate(data.startDate ? data.startDate.slice(0, 10) : '');
        setFormEndDate(data.endDate ? data.endDate.slice(0, 10) : '');
        setFormNote(data.note ?? '');
      })
      .catch(() => {
        setEditLoadedId(editingId); if (!cancelled) setFormName(''); });
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
      if (editParam) {
        router.push(`/${locale}/crm/projects/${editParam}`);
        return;
      }
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
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 inline-flex items-center gap-2">
                Projects
                <TitleCount count={total} />
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Track jobs and link them to customers and estimates.</p>
            </div>
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
          {projectCards.length ? (
            <div className={`mt-2 ${crmChrome?.searchOpen ? 'max-md:hidden' : ''}`}>
              <CrmStatCards cards={projectCards} active={statusFilter} onSelect={applyStatusFilter} />
            </div>
          ) : null}
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
            searchAside={(
              <div className="hidden md:flex md:shrink-0 md:flex-wrap md:items-center md:gap-2">
                <button
                  type="button"
                  onClick={() => applyStatusFilter('')}
                  className={`inline-flex h-11 shrink-0 items-center rounded-lg border-2 border-black px-3 text-sm font-medium cursor-pointer ${statusFilter === '' ? 'bg-black text-white' : 'bg-white text-black'}`}
                >
                  All
                </button>
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => applyStatusFilter(option)}
                    className={`inline-flex h-11 shrink-0 items-center rounded-lg border-2 border-black px-3 text-sm font-medium cursor-pointer ${statusFilter === option ? 'bg-black text-white' : 'bg-white text-black'}`}
                  >
                    {statusLabel(option)}
                  </button>
                ))}
              </div>
            )}
            hideBody={listView !== 'table'}
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
                // No costs recorded: a 100% profit would be misleading.
                if (row.project_cost_cents === 0) return <span className="text-xs text-gray-500">No costs yet</span>;
                return <span className={`tabular-nums font-medium ${profitTone(profitCents(row))}`}>{text}</span>;
              }
              if (columnId === 'schedule') {
                const text = scheduleText(row);
                return text ? <span className={text.endsWith('late') ? 'font-medium text-red-600' : ''}>{text}</span> : '—';
              }
              if (columnId === 'balance' && (row.balance_cents ?? 0) > 0) {
                return <span className="tabular-nums font-medium text-red-600">{projectCellText(row, columnId)}</span>;
              }
              if (['contract_amount', 'project_cost', 'invoiced', 'collected', 'balance'].includes(columnId)) {
                const text = projectCellText(row, columnId);
                return text ? <span className="tabular-nums">{text}</span> : '—';
              }
              return projectCellText(row, columnId) || '—';
            }}
            onRowClick={(row) => router.push(`/${locale}/crm/projects/${row.id}`)}
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
          {listView === 'chart' && (
            isProjectChart(chart) ? (
              <ProjectListChart
                chart={chart}
                filtered={Boolean(search)}
                activeStatus={statusFilter}
                onSelectStatus={applyStatusFilter}
              />
            ) : (
              <ChartLoading error={error} />
            )
          )}
          {listView === 'map' && (
            <AddressPinsMap
              pins={projects.map((row) => ({
                id: row.id,
                title: row.name,
                detail: `${listedCustomerName(row) || 'Project'} · ${statusLabel(row.status)}`,
                address: row.customerAddress || '',
              }))}
              onOpen={(id) => router.push(`/${locale}/crm/projects/${id}`)}
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
              views={['table', 'map', 'chart']}
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
            <button type="button" onClick={closeForm} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer">
              <ArrowLeft className="w-5 h-5 shrink-0" /> Back
            </button>
            <span className="text-lg font-semibold text-gray-900">{viewMode === 'add' ? 'New Project' : 'Edit Project'}</span>
          </div>
          {viewMode === 'edit' && editLoadedId !== editingId ? (
            <div className="space-y-4" aria-busy="true">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded-md bg-gray-200" />
                  <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
          <form onSubmit={viewMode === 'add' ? handleSubmitAdd : handleSubmitEdit} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{formError}</div>}
            <FormField label="Customer" required>
              <PickerSelect
                value={formCustomerId}
                onChange={(value) => { setFormCustomerId(value); setFormEstimateId(''); }}
                placeholder={"Select customer"}
                disabled={viewMode === 'edit'}
                options={customers.map((c) => ({ value: String(c.id), label: String(contactDisplayName(c)) }))}
              />
            </FormField>
            <FormField label="Estimate (optional)">
              <PickerSelect
                value={formEstimateId}
                onChange={(value) => setFormEstimateId(value)}
                noneLabel={"None"}
                options={estimatesForCustomer.map((est) => ({ value: String(est.id), label: `Estimate $${(est.amount_cents / 100).toFixed(2)}` }))}
              />
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
              <Input type="date" value={formEndDate} min={formStartDate || undefined} onChange={(e) => setFormEndDate(e.target.value)} />
              {projectDurationText(formStartDate, formEndDate) ? (
                <p className="mt-1 text-sm text-gray-700">Duration: <strong>{projectDurationText(formStartDate, formEndDate)}</strong></p>
              ) : null}
            </FormField>
            <FormField label="Note">
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional note" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={closeForm} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? 'Saving…' : viewMode === 'add' ? 'Create Project' : 'Save changes'}</Button>
            </div>
          </form>
          )}
        </div>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
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
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
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
        <Link href={`/${locale}/crm/projects/${rowActions.openId}`} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer font-medium" onClick={rowActions.close}>Financial report</Link>
        <Link href={`/${locale}/crm/projects/${rowActions.openId}/photos`} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={rowActions.close}>Photos</Link>
        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(rowActions.openId); setViewMode('edit'); rowActions.close(); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
        <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { if (rowActions.openId) setDeleteConfirm({ id: rowActions.openId }); rowActions.close(); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </CrmRowActionsPortal>
    </div>
  );
}
