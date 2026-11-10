'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Pencil, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { CrmRowActionsButton, CrmRowActionsPortal, useCrmRowActions } from '@/components/crm/CrmRowActionsMenu';
import { CRM_LIST_PAGE_SIZE, useCrmListQuery } from '@/hooks/useCrmListQuery';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { CustomerForm, emptyForm } from '@/components/crm/CustomerForm';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { categoryNeedsSupplier } from '@/lib/crm/expense-supplier';
import { UNIT_OPTIONS } from '@/lib/constants/unitOptions';

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
  description: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  po_number: string | null;
  quantity: number | string | null;
  unit: string | null;
  requested_by: string | null;
  ordered_by: string | null;
  created_at: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ContactListRow {
  id: string;
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatQty(value: number | string | null) {
  if (value == null || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? String(amount) : '';
}

const EXPENSE_COLUMNS: AdminDataTableColumn<ExpenseRow>[] = [
  { id: 'expense_date', label: 'Date', sortKey: 'expense_date', width: 140 },
  { id: 'amount', label: 'Amount', sortKey: 'amount_cents', width: 120 },
  { id: 'category', label: 'Category', sortKey: 'category', width: 150 },
  { id: 'po_number', label: 'PO', width: 120 },
  { id: 'supplier', label: 'Vendor', width: 180 },
  { id: 'description', label: 'Material', width: 220, wrap: true },
  { id: 'quantity', label: 'Qty', width: 90 },
  { id: 'unit', label: 'Unit', width: 110 },
  { id: 'requested_by', label: 'Requested by', width: 150 },
  { id: 'ordered_by', label: 'Ordered by', width: 150 },
  { id: 'note', label: 'Note', width: 200, wrap: true },
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
    case 'supplier':
      return row.supplier_name ?? '';
    case 'description':
      return row.description ?? '';
    case 'po_number':
      return row.po_number ?? '';
    case 'quantity':
      return formatQty(row.quantity);
    case 'unit':
      return row.unit ?? '';
    case 'requested_by':
      return row.requested_by ?? '';
    case 'ordered_by':
      return row.ordered_by ?? '';
    case 'note':
      return row.note ?? '';
    default:
      return '';
  }
}

type ViewMode = 'table' | 'add' | 'edit';

function DescriptionField({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const query = value.trim().toLowerCase();
  const matches = suggestions
    .filter((item) => item.toLowerCase() !== query && (query === '' || item.toLowerCase().includes(query)))
    .slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (item: string) => {
    onChange(item);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => (index + 1) % matches.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => (index <= 0 ? matches.length - 1 : index - 1));
          } else if (event.key === 'Enter' && highlight >= 0) {
            event.preventDefault();
            choose(matches[highlight]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border-2 border-black bg-white py-1 shadow-lg" role="listbox">
          {matches.map((item, index) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={highlight === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(item)}
              className={`w-full cursor-pointer px-3 py-2 text-left text-sm ${highlight === index ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CRMExpensesPage() {
  const searchParams = useSearchParams();
  const {
    rows: expenses,
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
    reload: fetchExpenses,
    handleSort,
    handleSearchInput,
    handleSearchSubmit,
  } = useCrmListQuery<ExpenseRow>({
    endpoint: '/api/crm/expenses',
    rowsKey: 'expenses',
    defaultSort: 'expense_date',
    loadError: 'Failed to load expenses',
  });
  const rowActions = useCrmRowActions();

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProjectId, setFormProjectId] = useState('');
  const [formAmountDollars, setFormAmountDollars] = useState('');
  const [formCategory, setFormCategory] = useState('other');
  const [formDate, setFormDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formRequestedBy, setFormRequestedBy] = useState('');
  const [formOrderedBy, setFormOrderedBy] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [supplierRoleId, setSupplierRoleId] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (searchParams.get('new') === '1') setViewMode('add');
  }, [searchParams]);

  useEffect(() => {
    if (viewMode !== 'add' && viewMode !== 'edit') return;
    let cancelled = false;
    fetch('/api/crm/projects?pageSize=500', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProjects(d.projects ?? []); })
      .catch(() => { if (!cancelled) setProjects([]); });
    fetch('/api/crm/customers?role=supplier&pageSize=500', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { customers?: ContactListRow[] }) => {
        if (cancelled) return;
        const options = (data.customers ?? [])
          .map((customer) => ({ id: customer.id, name: contactDisplayName(customer) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSuppliers((current) => {
          const byId = new Map(options.map((option) => [option.id, option]));
          for (const existing of current) {
            if (!byId.has(existing.id)) byId.set(existing.id, existing);
          }
          return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
        });
      })
      .catch(() => { if (!cancelled) setSuppliers([]); });
    fetch('/api/crm/roles', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { roles?: { id: string; slug: string }[] }) => {
        if (cancelled) return;
        const supplier = (data.roles ?? []).find((role) => role.slug === 'supplier');
        if (supplier) setSupplierRoleId(supplier.id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'add' && viewMode !== 'edit') return;
    let cancelled = false;
    fetch('/api/crm/expenses?suggestions=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { descriptions?: string[] }) => { if (!cancelled) setDescriptions(data.descriptions ?? []); })
      .catch(() => { if (!cancelled) setDescriptions([]); });
    return () => { cancelled = true; };
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
        setFormDescription(data.description ?? '');
        setFormSupplierId(data.supplierId ?? '');
        setFormPoNumber(data.poNumber ?? '');
        setFormQuantity(data.quantity === '' || data.quantity == null ? '' : String(data.quantity));
        setFormUnit(data.unit ?? '');
        setFormRequestedBy(data.requestedBy ?? '');
        setFormOrderedBy(data.orderedBy ?? '');
        if (data.supplierId && data.supplierName) {
          setSuppliers((current) => (
            current.some((supplier) => supplier.id === data.supplierId)
              ? current
              : [...current, { id: data.supplierId, name: data.supplierName }].sort((a, b) => a.name.localeCompare(b.name))
          ));
        }
      })
      .catch(() => { if (!cancelled) setFormAmountDollars(''); });
    return () => { cancelled = true; };
  }, [viewMode, editingId]);

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
          description: formDescription.trim() || null,
          supplierId: categoryNeedsSupplier(formCategory) ? formSupplierId || null : null,
          poNumber: categoryNeedsSupplier(formCategory) ? formPoNumber.trim() || null : null,
          quantity: categoryNeedsSupplier(formCategory) ? formQuantity : null,
          unit: categoryNeedsSupplier(formCategory) ? formUnit.trim() || null : null,
          requestedBy: categoryNeedsSupplier(formCategory) ? formRequestedBy.trim() || null : null,
          orderedBy: categoryNeedsSupplier(formCategory) ? formOrderedBy.trim() || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create expense');
      setViewMode('table');
      setFormProjectId(''); setFormAmountDollars(''); setFormCategory('other'); setFormDate(''); setFormNote(''); setFormDescription(''); setFormSupplierId(''); setFormPoNumber(''); setFormQuantity(''); setFormUnit(''); setFormRequestedBy(''); setFormOrderedBy('');
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
          description: formDescription.trim() || null,
          supplierId: categoryNeedsSupplier(formCategory) ? formSupplierId || null : null,
          poNumber: categoryNeedsSupplier(formCategory) ? formPoNumber.trim() || null : null,
          quantity: categoryNeedsSupplier(formCategory) ? formQuantity : null,
          unit: categoryNeedsSupplier(formCategory) ? formUnit.trim() || null : null,
          requestedBy: categoryNeedsSupplier(formCategory) ? formRequestedBy.trim() || null : null,
          orderedBy: categoryNeedsSupplier(formCategory) ? formOrderedBy.trim() || null : null,
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
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => { setEditingId(null); setFormProjectId(''); setFormAmountDollars(''); setFormCategory('other'); setFormDate(''); setFormNote(''); setFormDescription(''); setFormSupplierId(''); setFormPoNumber(''); setFormQuantity(''); setFormUnit(''); setFormRequestedBy(''); setFormOrderedBy(''); setFormError(null); setViewMode('add'); }}>
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
            searchPlaceholder="Search PO, material, category, or note…"
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            error={error}
            getRowId={(row) => row.id}
            getCellText={expenseCellText}
            renderCell={(row, columnId) => expenseCellText(row, columnId) || '—'}
            onRowClick={(row) => { setEditingId(row.id); setViewMode('edit'); }}
            renderActions={(row) => (
              <CrmRowActionsButton rowId={row.id} openId={rowActions.openId} onToggle={rowActions.toggle} />
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
              <Select
                value={formCategory}
                onChange={(e) => {
                  const next = e.target.value;
                  setFormCategory(next);
                  if (!categoryNeedsSupplier(next)) setFormSupplierId('');
                }}
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            {categoryNeedsSupplier(formCategory) && (
              <>
                <FormField label="PO">
                  <Input value={formPoNumber} onChange={(e) => setFormPoNumber(e.target.value)} placeholder="PO number" />
                </FormField>
                <FormField label="Vendor" tip="Vendors are contacts with the Supplier role. Add a new one if they are not in the list.">
                  <Select
                    value={formSupplierId}
                    onChange={(e) => {
                      if (e.target.value !== '__new__') {
                        setFormSupplierId(e.target.value);
                        return;
                      }
                      const openContact = async () => {
                        let roleId = supplierRoleId;
                        if (!roleId) {
                          try {
                            const res = await fetch('/api/crm/roles', { credentials: 'include' });
                            const data = await res.json();
                            roleId = (data.roles ?? []).find((role: { slug: string; id: string }) => role.slug === 'supplier')?.id ?? '';
                            if (roleId) setSupplierRoleId(roleId);
                          } catch {
                            roleId = '';
                          }
                        }
                        if (!roleId) {
                          setFormError('Supplier role is not set up yet.');
                          return;
                        }
                        setFormError(null);
                        setShowContactModal(true);
                      };
                      void openContact();
                    }}
                  >
                    <option value="">Select vendor</option>
                    <option value="__new__">Add new supplier</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </Select>
                </FormField>
              </>
            )}
            <FormField
              label={formCategory === 'materials' ? 'Material' : formCategory === 'equipment' ? 'Item' : 'Description'}
              tip={descriptions.length > 0 ? 'Choose one you already used, or type a new one.' : undefined}
            >
              <DescriptionField
                value={formDescription}
                onChange={setFormDescription}
                suggestions={descriptions}
                placeholder={formCategory === 'materials' ? 'Drywall, lumber, concrete…' : 'What was this expense for?'}
              />
            </FormField>
            {categoryNeedsSupplier(formCategory) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Qty">
                    <Input type="number" min="0" step="any" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} placeholder="0" />
                  </FormField>
                  <FormField label="Unit">
                    <Select value={formUnit} onChange={(e) => setFormUnit(e.target.value)}>
                      <option value="">Select unit</option>
                      {UNIT_OPTIONS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Requested by">
                    <Input value={formRequestedBy} onChange={(e) => setFormRequestedBy(e.target.value)} placeholder="Who asked for it" />
                  </FormField>
                  <FormField label="Ordered by">
                    <Input value={formOrderedBy} onChange={(e) => setFormOrderedBy(e.target.value)} placeholder="Who placed the order" />
                  </FormField>
                </div>
              </>
            )}
            <FormField label={categoryNeedsSupplier(formCategory) ? 'Order date' : 'Date'} required>
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

      {showContactModal && (
        <Modal
          isOpen
          onClose={() => setShowContactModal(false)}
          title="New contact"
          showHeader
          showCloseButton
          maxWidth="6xl"
          contentClassName="p-4 md:p-6"
        >
          <CustomerForm
            mode="add"
            initial={{ ...emptyForm, roleIds: supplierRoleId ? [supplierRoleId] : [] }}
            onCancel={() => setShowContactModal(false)}
            onSuccess={(created) => {
              setShowContactModal(false);
              if (!created) return;
              setSuppliers((current) => (
                current.some((supplier) => supplier.id === created.id)
                  ? current
                  : [...current, created].sort((a, b) => a.name.localeCompare(b.name))
              ));
              setFormSupplierId(created.id);
            }}
          />
        </Modal>
      )}

      <CrmRowActionsPortal openId={rowActions.openId} position={rowActions.position} menuRef={rowActions.menuRef}>
        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(rowActions.openId); setViewMode('edit'); rowActions.close(); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
        <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { if (rowActions.openId) setDeleteConfirm({ id: rowActions.openId }); rowActions.close(); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </CrmRowActionsPortal>
    </div>
  );
}
