'use client';

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'expense_date', label: 'Date' },
  { value: 'created_at', label: 'Created' },
  { value: 'amount_cents', label: 'Amount' },
  { value: 'category', label: 'Category' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const CATEGORY_OPTIONS = ['materials', 'labor', 'subcontractor', 'equipment', 'permits', 'other'] as const;

interface ExpenseRow {
  id: string;
  project_id: string | null;
  amount_cents: number;
  category: string;
  expense_date: string;
  note: string | null;
  created_at: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const EXPENSE_COLUMNS: AdminDataTableColumn<ExpenseRow>[] = [
  { id: 'expense_date', label: 'Date', sortKey: 'expense_date', width: 140 },
  { id: 'amount', label: 'Amount', sortKey: 'amount_cents', width: 120 },
  { id: 'category', label: 'Category', sortKey: 'category', width: 150 },
  { id: 'note', label: 'Note', width: 240, wrap: true },
  { id: 'actions', label: 'Actions', resizable: false },
];

function expenseCellText(row: ExpenseRow, columnId: string): string {
  switch (columnId) {
    case 'expense_date':
      return formatDate(row.expense_date);
    case 'amount':
      return formatAmount(row.amount_cents);
    case 'category':
      return row.category;
    case 'note':
      return row.note ?? '';
    default:
      return '';
  }
}

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('expense_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProjectId, setFormProjectId] = useState('');
  const [formAmountDollars, setFormAmountDollars] = useState('');
  const [formCategory, setFormCategory] = useState('other');
  const [formDate, setFormDate] = useState('');
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

  const fetchExpenses = useCallback(async () => {
    const isFirst = !hasLoadedOnceRef.current;
    try {
      if (isFirst) setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
      if (search) params.set('search', search);
      const res = await fetch(`/api/crm/expenses?${params}`, { credentials: 'include' });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
      if (isFirst) { setExpenses([]); setTotal(0); }
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortDir, search]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    if (viewMode === 'add' || viewMode === 'edit') {
      fetch('/api/crm/projects?pageSize=500', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setProjects(d.projects ?? []))
        .catch(() => setProjects([]));
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'edit' || !editingId) return;
    let cancelled = false;
    fetch(`/api/crm/expenses/${editingId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setFormProjectId(data.projectId ?? '');
        setFormAmountDollars(data.amountCents != null ? (data.amountCents / 100).toFixed(2) : '');
        setFormCategory(data.category ?? 'other');
        setFormDate(data.expenseDate ? data.expenseDate.slice(0, 10) : '');
        setFormNote(data.note ?? '');
      })
      .catch(() => { if (!cancelled) setFormAmountDollars(''); });
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
  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };
  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/expenses/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
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
        const res = await fetch(`/api/crm/expenses/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
      }
      setBulkDeleteIds(null);
      fetchExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expenses');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amountCents = Math.round(parseFloat(formAmountDollars || '0') * 100);
    setSaving(true);
    try {
      const res = await fetch('/api/crm/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: formProjectId || null,
          amountCents,
          category: formCategory,
          expenseDate: formDate || new Date().toISOString().slice(0, 10),
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create expense');
      setViewMode('table');
      setFormProjectId(''); setFormAmountDollars(''); setFormCategory('other'); setFormDate(''); setFormNote('');
      fetchExpenses();
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
      const res = await fetch(`/api/crm/expenses/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: formProjectId || null,
          amountCents,
          category: formCategory,
          expenseDate: formDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update expense');
      setViewMode('table');
      setEditingId(null);
      fetchExpenses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const defaultDate = formDate || new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Expenses</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track expenses and optionally link to projects.</p>
            </div>
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Expense
            </Button>
          </div>
          <AdminDataTable
            columnOrderKey="crm-expenses"
            exportName="expenses"
            columns={EXPENSE_COLUMNS}
            data={expenses}
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
            searchPlaceholder="Search category or note…"
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            error={error}
            getRowId={(row) => row.id}
            getCellText={expenseCellText}
            renderCell={(row, columnId) => expenseCellText(row, columnId) || '—'}
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
            emptyMessage="No expenses found."
            itemLabel="expenses"
            primaryColumnId="amount"
          />
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full md:max-w-xl md:mx-auto">
          <div className="py-2 md:mb-6 flex items-center justify-between gap-4">
            <button type="button" onClick={() => { setViewMode('table'); setEditingId(null); }} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer">
              <ArrowLeft className="w-5 h-5 shrink-0" /> Back
            </button>
            <span className="text-lg font-semibold text-gray-900">{viewMode === 'add' ? 'New Expense' : 'Edit Expense'}</span>
          </div>
          <form onSubmit={viewMode === 'add' ? handleSubmitAdd : handleSubmitEdit} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{formError}</div>}
            <FormField label="Project (optional)">
              <Select value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Amount ($)" required>
              <Input type="number" step="0.01" min="0" value={formAmountDollars} onChange={(e) => setFormAmountDollars(e.target.value)} placeholder="0.00" required />
            </FormField>
            <FormField label="Category">
              <Select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            <FormField label="Date" required>
              <Input type="date" value={formDate || defaultDate} onChange={(e) => setFormDate(e.target.value)} required />
            </FormField>
            <FormField label="Note">
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional note" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => { setViewMode('table'); setEditingId(null); }} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? 'Saving…' : viewMode === 'add' ? 'Create Expense' : 'Save changes'}</Button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete expense?</h2>
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete expenses?</h2>
            <p className="text-gray-600 mb-6">Delete {bulkDeleteIds.length} expense{bulkDeleteIds.length === 1 ? '' : 's'}? This cannot be undone.</p>
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
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(openActionsId); setViewMode('edit'); setOpenActionsId(null); setMenuPosition(null); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setDeleteConfirm({ id: openActionsId }); setOpenActionsId(null); setMenuPosition(null); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </div>,
          document.body
        )}
    </div>
  );
}
