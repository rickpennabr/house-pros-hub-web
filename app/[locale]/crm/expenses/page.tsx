'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Pencil, Trash2, ArrowLeft, AlertTriangle, ChevronDown, Printer } from 'lucide-react';
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

/** Direct costs on a project. */
const JOB_COST_CATEGORIES = [
  'Materials',
  'Delivery',
  'Labor',
  'Subcontractor',
  'Equipment',
  'Permits',
  'Disposal',
  'Fuel',
  'Tools',
] as const;

/** Overhead for contractors, realtors, handymen, and other house pros. */
const BUSINESS_COST_CATEGORIES = [
  'Vehicle',
  'Mileage',
  'Insurance',
  'Workers comp',
  'Advertising',
  'Marketing',
  'Signs',
  'Photography',
  'Staging',
  'Commissions',
  'Office',
  'Accounting',
  'Software',
  'Card fees',
  'Phone',
  'Rent',
  'Utilities',
  'Licenses',
  'Supplies',
  'Meals',
  'Payroll',
  'Taxes',
  'Repairs',
  'Training',
  'Dues',
] as const;

function sameCategory(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function kindForCategory(value: string): '' | 'job' | 'business' {
  if (JOB_COST_CATEGORIES.some((item) => sameCategory(item, value))) return 'job';
  if (BUSINESS_COST_CATEGORIES.some((item) => sameCategory(item, value))) return 'business';
  return '';
}

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

function expenseTypeLabel(category: string): string {
  const kind = kindForCategory(category);
  if (kind === 'job') return 'Job';
  if (kind === 'business') return 'Business';
  return 'Other';
}

const EXPENSE_COLUMNS: AdminDataTableColumn<ExpenseRow>[] = [
  { id: 'expense_date', label: 'Date', sortKey: 'expense_date', width: 140 },
  { id: 'type', label: 'Type', width: 110 },
  { id: 'project', label: 'Project', width: 180 },
  { id: 'po_number', label: 'PO', width: 120 },
  { id: 'supplier', label: 'Vendor', width: 180 },
  { id: 'category', label: 'Category', sortKey: 'category', width: 150 },
  { id: 'amount', label: 'Amount', sortKey: 'amount_cents', width: 120 },
  { id: 'description', label: 'Material', width: 220, wrap: true },
  { id: 'quantity', label: 'Qty', width: 90 },
  { id: 'unit', label: 'Unit', width: 110 },
  { id: 'requested_by', label: 'Requested by', width: 150 },
  { id: 'ordered_by', label: 'Ordered by', width: 150 },
  { id: 'note', label: 'Note', width: 200, wrap: true },
  { id: 'actions', label: 'Actions', resizable: false },
];

const PRINT_COLUMNS = [
  { id: 'expense_date', label: 'Date' },
  { id: 'type', label: 'Type' },
  { id: 'project', label: 'Project' },
  { id: 'po_number', label: 'PO' },
  { id: 'supplier', label: 'Vendor' },
  { id: 'category', label: 'Category' },
  { id: 'amount', label: 'Amount' },
  { id: 'note', label: 'Note' },
] as const;

function expenseCellText(row: ExpenseRow, columnId: string, projectName = ''): string {
  switch (columnId) {
    case 'expense_date':
      return formatDate(row.expense_date);
    case 'type':
      return expenseTypeLabel(row.category);
    case 'project':
      return projectName;
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
  maxVisible = 8,
  showMenu = false,
  addNewLabel,
  onAddNew,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
  maxVisible?: number;
  showMenu?: boolean;
  addNewLabel?: string;
  onAddNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const query = value.trim().toLowerCase();
  const matches = suggestions
    .filter((item) => item.toLowerCase() !== query && (query === '' || item.toLowerCase().includes(query)))
    .slice(0, maxVisible);

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
        className={showMenu ? 'pr-10' : ''}
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
      {showMenu && (
        <button
          type="button"
          aria-label="Show categories"
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-black"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
      {open && (matches.length > 0 || onAddNew) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border-2 border-black bg-white shadow-lg" role="listbox">
          {matches.length > 0 && (
            <div className={`overflow-y-auto py-1 ${maxVisible > 8 ? 'max-h-72' : 'max-h-56'}`}>
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
          {onAddNew && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onAddNew();
                setOpen(false);
                setHighlight(-1);
              }}
              className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 ${matches.length > 0 ? 'border-t border-gray-200' : ''}`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {addNewLabel}
            </button>
          )}
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
  const [projectName, setProjectName] = useState('');
  const [billableCustomers, setBillableCustomers] = useState<{ id: string; name: string }[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [showProjectCustomerModal, setShowProjectCustomerModal] = useState(false);
  const [projectEstimates, setProjectEstimates] = useState<{ id: string; customer_id: string; amount_cents: number }[]>([]);
  const [projectDraft, setProjectDraft] = useState({
    customerId: '',
    estimateId: '',
    name: '',
    status: 'planned',
    startDate: '',
    endDate: '',
    note: '',
  });
  const [formAmountDollars, setFormAmountDollars] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [expenseKind, setExpenseKind] = useState<'' | 'job' | 'business'>('');
  const [pickingOther, setPickingOther] = useState(false);
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
    if (viewMode !== 'add') return;
    setExpenseKind('');
    setFormCategory('');
    setPickingOther(false);
    setFormProjectId('');
    setProjectName('');
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm/projects?pageSize=500', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProjects(d.projects ?? []); })
      .catch(() => { if (!cancelled) setProjects([]); });
    return () => { cancelled = true; };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'add' && viewMode !== 'edit') return;
    let cancelled = false;
    fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { customers?: ContactListRow[] }) => {
        if (cancelled) return;
        setBillableCustomers(
          (data.customers ?? [])
            .map((customer) => ({ id: customer.id, name: contactDisplayName(customer) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => { if (!cancelled) setBillableCustomers([]); });
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
    if (!showProjectModal) return;
    let cancelled = false;
    fetch('/api/crm/estimates?pageSize=500', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { estimates?: { id: string; customer_id: string; amount_cents: number }[] }) => {
        if (!cancelled) setProjectEstimates(data.estimates ?? []);
      })
      .catch(() => { if (!cancelled) setProjectEstimates([]); });
    return () => { cancelled = true; };
  }, [showProjectModal]);

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
        setFormCategory(data.category ?? '');
        setExpenseKind(kindForCategory(data.category ?? ''));
        setPickingOther(Boolean((data.category ?? '').trim()) && !kindForCategory(data.category ?? ''));
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

  const chooseCategory = (next: string) => {
    setFormCategory(next);
    if (!categoryNeedsSupplier(next)) setFormSupplierId('');
  };

  const chooseKind = (next: 'job' | 'business') => {
    setExpenseKind(next);
    setPickingOther(false);
    if (next !== 'job') {
      setFormProjectId('');
      setProjectName('');
    }
    const types = next === 'job' ? JOB_COST_CATEGORIES : BUSINESS_COST_CATEGORIES;
    if (!types.some((item) => sameCategory(item, formCategory))) chooseCategory('');
  };

  const matchedProject = projects.find((item) => item.id === formProjectId)
    ?? projects.find((item) => item.name.trim().toLowerCase() === projectName.trim().toLowerCase());

  useEffect(() => {
    if (!formProjectId) return;
    const project = projects.find((item) => item.id === formProjectId);
    if (project) setProjectName(project.name);
  }, [formProjectId, projects]);

  const openNewProject = () => {
    const typed = projectName.trim();
    const known = projects.some((item) => item.name.trim().toLowerCase() === typed.toLowerCase());
    setProjectDraft({
      customerId: '',
      estimateId: '',
      name: known ? '' : typed,
      status: 'planned',
      startDate: '',
      endDate: '',
      note: '',
    });
    setProjectFormError(null);
    setShowProjectModal(true);
  };

  const projectIdForSave = (): string | null | false => {
    if (expenseKind !== 'job') return null;
    if (matchedProject) return matchedProject.id;
    if (projectName.trim()) openNewProject();
    else setFormError('Select or add a project.');
    return false;
  };

  const saveNewProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = projectDraft.name.trim();
    if (!projectDraft.customerId || !name) {
      setProjectFormError('Customer and project name are required.');
      return;
    }
    setSavingProject(true);
    setProjectFormError(null);
    try {
      const res = await fetch('/api/crm/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: projectDraft.customerId,
          estimateId: projectDraft.estimateId || null,
          name,
          status: projectDraft.status,
          startDate: projectDraft.startDate || null,
          endDate: projectDraft.endDate || null,
          note: projectDraft.note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error || 'Failed to add project');
      setProjects((current) => [...current, { id: data.id as string, name }].sort((a, b) => a.name.localeCompare(b.name)));
      setFormProjectId(data.id);
      setProjectName(name);
      setShowProjectModal(false);
    } catch (err) {
      setProjectFormError(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setSavingProject(false);
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const category = formCategory.trim();
    if (!category) {
      setFormError('Select or add a category.');
      return;
    }
    const projectId = projectIdForSave();
    if (projectId === false) return;
    const amountCents = Math.round(parseFloat(formAmountDollars || '0') * 100);
    setSaving(true);
    try {
      const res = await fetch('/api/crm/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          amountCents,
          category,
          expenseDate: formDate || new Date().toISOString().slice(0, 10),
          note: formNote.trim() || null,
          description: formDescription.trim() || null,
          supplierId: categoryNeedsSupplier(category) ? formSupplierId || null : null,
          poNumber: categoryNeedsSupplier(category) ? formPoNumber.trim() || null : null,
          quantity: categoryNeedsSupplier(category) ? formQuantity : null,
          unit: categoryNeedsSupplier(category) ? formUnit.trim() || null : null,
          requestedBy: categoryNeedsSupplier(category) ? formRequestedBy.trim() || null : null,
          orderedBy: categoryNeedsSupplier(category) ? formOrderedBy.trim() || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create expense');
      setViewMode('table');
      setFormProjectId(''); setProjectName(''); setFormAmountDollars(''); setFormCategory(''); setExpenseKind(''); setPickingOther(false); setFormDate(''); setFormNote(''); setFormDescription(''); setFormSupplierId(''); setFormPoNumber(''); setFormQuantity(''); setFormUnit(''); setFormRequestedBy(''); setFormOrderedBy('');
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
    const category = formCategory.trim();
    if (!category) {
      setFormError('Select or add a category.');
      return;
    }
    const projectId = projectIdForSave();
    if (projectId === false) return;
    const amountCents = Math.round(parseFloat(formAmountDollars || '0') * 100);
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/expenses/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          amountCents,
          category,
          expenseDate: formDate || null,
          note: formNote.trim() || null,
          description: formDescription.trim() || null,
          supplierId: categoryNeedsSupplier(category) ? formSupplierId || null : null,
          poNumber: categoryNeedsSupplier(category) ? formPoNumber.trim() || null : null,
          quantity: categoryNeedsSupplier(category) ? formQuantity : null,
          unit: categoryNeedsSupplier(category) ? formUnit.trim() || null : null,
          requestedBy: categoryNeedsSupplier(category) ? formRequestedBy.trim() || null : null,
          orderedBy: categoryNeedsSupplier(category) ? formOrderedBy.trim() || null : null,
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
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const openNewExpense = () => {
    setEditingId(null);
    setFormProjectId('');
    setProjectName('');
    setFormAmountDollars('');
    setFormCategory('');
    setExpenseKind('');
    setPickingOther(false);
    setFormDate('');
    setFormNote('');
    setFormDescription('');
    setFormSupplierId('');
    setFormPoNumber('');
    setFormQuantity('');
    setFormUnit('');
    setFormRequestedBy('');
    setFormOrderedBy('');
    setFormError(null);
    setViewMode('add');
  };
  const projectNameFor = (row: ExpenseRow) => (row.project_id ? projectNameById.get(row.project_id) ?? '' : '');
  const cellText = (row: ExpenseRow, columnId: string) => expenseCellText(row, columnId, projectNameFor(row));
  const pageTotalCents = expenses.reduce((sum, row) => sum + (row.amount_cents || 0), 0);

  return (
    <div className="w-full">
      {viewMode === 'table' && (
        <>
          <div className="expense-print-sheet text-black">
            <h1 className="text-xl font-bold">Expenses</h1>
            <p className="mt-1 text-sm">
              Printed {new Date().toLocaleString()} · page {page} · {expenses.length} shown
            </p>
            <table className="mt-4 w-full border-collapse text-xs">
              <thead>
                <tr>
                  {PRINT_COLUMNS.map((column) => (
                    <th key={column.id} className="border border-black px-2 py-1 text-left font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => (
                  <tr key={row.id}>
                    {PRINT_COLUMNS.map((column) => (
                      <td key={column.id} className="border border-black px-2 py-1 align-top">
                        {cellText(row, column.id) || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="border border-black px-2 py-1 text-right font-semibold">
                    Page total
                  </td>
                  <td className="border border-black px-2 py-1 font-semibold">{formatAmount(pageTotalCents)}</td>
                  <td className="border border-black px-2 py-1" />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="no-print">
          <div className="hidden md:flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Expenses</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track expenses and optionally link to projects.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={() => window.print()} disabled={expenses.length === 0}>
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={openNewExpense}>
                <Plus className="w-4 h-4" />
                New Expense
              </Button>
            </div>
          </div>
          <AdminDataTable
            searchRowClassName="max-md:pt-2"
            columnOrderKey="crm-expenses-v2"
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
            getCellText={cellText}
            renderCell={(row, columnId) => cellText(row, columnId) || '—'}
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
          {viewMode === 'table' && !isLoading && (
            <button
              type="button"
              onClick={openNewExpense}
              className="md:hidden fixed bottom-[100px] right-[50px] z-50 h-12 w-12 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all shadow-lg"
              aria-label="New expense"
            >
              <Plus className="w-6 h-6 text-white" />
            </button>
          )}
          </div>
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
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">Expense type</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['job', 'Project cost'],
                  ['business', 'Business cost'],
                ] as const).map(([kind, label]) => {
                  const selected = expenseKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseKind(kind)}
                      className={`h-12 cursor-pointer rounded-lg border-2 border-black text-sm font-medium ${selected ? 'bg-black text-white' : 'bg-white text-black'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {expenseKind === 'job' && (
              <>
                <FormField label="Project" required>
                  <DescriptionField
                    value={projectName}
                    onChange={(next) => {
                      setProjectName(next);
                      const match = projects.find((item) => item.name.trim().toLowerCase() === next.trim().toLowerCase());
                      setFormProjectId(match?.id ?? '');
                    }}
                    suggestions={projects.map((item) => item.name)}
                    placeholder="Select or add project"
                    maxVisible={40}
                    showMenu
                    addNewLabel="Add new project"
                    onAddNew={openNewProject}
                  />
                </FormField>
              </>
            )}
            {expenseKind && (
              <FormField label={expenseKind === 'job' ? 'Project cost' : 'Business cost'}>
                <Select
                  value={
                    (expenseKind === 'job' ? JOB_COST_CATEGORIES : BUSINESS_COST_CATEGORIES).find((item) => sameCategory(item, formCategory))
                    ?? (pickingOther || formCategory.trim() ? '__other__' : '')
                  }
                  onChange={(event) => {
                    if (event.target.value === '__other__') {
                      setPickingOther(true);
                      if (kindForCategory(formCategory)) chooseCategory('');
                      return;
                    }
                    setPickingOther(false);
                    chooseCategory(event.target.value);
                  }}
                >
                  <option value="">Select type</option>
                  {(expenseKind === 'job' ? JOB_COST_CATEGORIES : BUSINESS_COST_CATEGORIES).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__other__">Other</option>
                </Select>
              </FormField>
            )}
            {expenseKind && (pickingOther || (formCategory.trim() !== '' && !kindForCategory(formCategory))) && (
              <FormField label="Other category">
                <Input
                  value={kindForCategory(formCategory) ? '' : formCategory}
                  onChange={(event) => chooseCategory(event.target.value)}
                  placeholder="Type a category"
                />
              </FormField>
            )}
            <FormField label="Amount ($)" required>
              <Input type="number" step="0.01" min="0" value={formAmountDollars} onChange={(e) => setFormAmountDollars(e.target.value)} placeholder="0.00" required />
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
              label={formCategory.trim().toLowerCase() === 'materials' ? 'Material' : formCategory.trim().toLowerCase() === 'equipment' ? 'Item' : 'Description'}
              tip={descriptions.length > 0 ? 'Choose one you already used, or type a new one.' : undefined}
            >
              <DescriptionField
                value={formDescription}
                onChange={setFormDescription}
                suggestions={descriptions}
                placeholder={formCategory.trim().toLowerCase() === 'materials' ? 'Drywall, lumber, concrete…' : 'What was this expense for?'}
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

      {showProjectModal && (
        <Modal
          isOpen
          onClose={() => { if (!savingProject && !showProjectCustomerModal) setShowProjectModal(false); }}
          title="New project"
          showHeader
          showCloseButton
          maxWidth="lg"
          contentClassName="p-4 md:p-6"
          preventCloseOnOverlayClick={savingProject || showProjectCustomerModal}
        >
          <form onSubmit={(event) => { void saveNewProject(event); }} className="space-y-4">
            {projectFormError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{projectFormError}</div>}
            <FormField label="Customer" required>
              <Select
                value={projectDraft.customerId}
                onChange={(event) => {
                  if (event.target.value === '__new__') {
                    setShowProjectCustomerModal(true);
                    return;
                  }
                  setProjectDraft((current) => ({ ...current, customerId: event.target.value, estimateId: '' }));
                }}
                required
              >
                <option value="">Select customer</option>
                <option value="__new__">Add new customer</option>
                {billableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Project name" required>
              <Input
                value={projectDraft.name}
                onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Kitchen remodel"
                required
                autoFocus
              />
            </FormField>
            <FormField label="Estimate (optional)">
              <Select
                value={projectDraft.estimateId}
                onChange={(event) => setProjectDraft((current) => ({ ...current, estimateId: event.target.value }))}
              >
                <option value="">None</option>
                {projectEstimates
                  .filter((estimate) => estimate.customer_id === projectDraft.customerId)
                  .map((estimate) => (
                    <option key={estimate.id} value={estimate.id}>Estimate ${(estimate.amount_cents / 100).toFixed(2)}</option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select
                value={projectDraft.status}
                onChange={(event) => setProjectDraft((current) => ({ ...current, status: event.target.value }))}
              >
                {(['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const).map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Start date">
              <Input type="date" value={projectDraft.startDate} onChange={(event) => setProjectDraft((current) => ({ ...current, startDate: event.target.value }))} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={projectDraft.endDate} onChange={(event) => setProjectDraft((current) => ({ ...current, endDate: event.target.value }))} />
            </FormField>
            <FormField label="Note">
              <Input value={projectDraft.note} onChange={(event) => setProjectDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowProjectModal(false)} disabled={savingProject}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingProject}>{savingProject ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showProjectCustomerModal && (
        <Modal
          isOpen
          onClose={() => setShowProjectCustomerModal(false)}
          title="New customer"
          showHeader
          showCloseButton
          maxWidth="6xl"
          contentClassName="p-4 md:p-6"
        >
          <CustomerForm
            mode="add"
            initial={emptyForm}
            onCancel={() => setShowProjectCustomerModal(false)}
            onSuccess={(created) => {
              setShowProjectCustomerModal(false);
              if (!created) return;
              setBillableCustomers((current) => (
                current.some((customer) => customer.id === created.id)
                  ? current
                  : [...current, created].sort((a, b) => a.name.localeCompare(b.name))
              ));
              setProjectDraft((current) => ({ ...current, customerId: created.id, estimateId: '' }));
            }}
          />
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
