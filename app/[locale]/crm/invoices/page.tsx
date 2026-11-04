'use client';

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Plus, Pencil, Trash2, MoreVertical, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { formatInvoiceDueDisplay } from '@/lib/invoices/invoiceDueOnReceipt';
import { invoiceStatusLabel } from '@/lib/crm/invoice-books';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'status', label: 'Status' },
  { value: 'invoice_date', label: 'Invoice date' },
  { value: 'due_date', label: 'Due date' },
  { value: 'amount_cents', label: 'Amount' },
  { value: 'invoice_number', label: 'Invoice #' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const STATUS_OPTIONS = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'] as const;

interface InvoiceRow {
  id: string;
  customer_id: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  invoice_number: string;
  amount_cents: number;
  status: string;
  invoice_date: string;
  due_date: string | null;
  payment_terms?: string | null;
  created_at: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const INVOICE_COLUMNS: AdminDataTableColumn<InvoiceRow>[] = [
  { id: 'invoice_number', label: 'Invoice #', sortKey: 'invoice_number', width: 140 },
  { id: 'customer', label: 'Customer', width: 180 },
  { id: 'amount', label: 'Amount', sortKey: 'amount_cents', width: 120 },
  { id: 'status', label: 'Status', sortKey: 'status', width: 120 },
  { id: 'due', label: 'Due', sortKey: 'due_date', width: 160 },
  { id: 'invoice_date', label: 'Invoice date', sortKey: 'invoice_date', width: 140 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function invoiceCellText(row: InvoiceRow, columnId: string): string {
  switch (columnId) {
    case 'invoice_number':
      return row.invoice_number;
    case 'customer':
      return [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ');
    case 'amount':
      return formatAmount(row.amount_cents);
    case 'status':
      return invoiceStatusLabel(row.status);
    case 'due':
      return formatInvoiceDueDisplay(row.invoice_date, row.due_date, row.payment_terms, formatDate);
    case 'invoice_date':
      return formatDate(row.invoice_date);
    default:
      return '';
  }
}

export default function CRMInvoicesPage() {
  const router = useRouter();
  const locale = useLocale();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchInvoices = useCallback(async () => {
    const isFirst = !hasLoadedOnceRef.current;
    try {
      if (isFirst) setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/crm/invoices?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      if (isFirst) { setInvoices([]); setTotal(0); }
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortDir, statusFilter, search]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

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
      const res = await fetch(`/api/crm/invoices/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
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
        const res = await fetch(`/api/crm/invoices/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
      }
      setBulkDeleteIds(null);
      fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoices');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage invoices. Convert estimates to invoices.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/${locale}/crm/invoices/recurring`}>
            <Button variant="secondary" size="sm" className="h-9">Recurring</Button>
          </Link>
          <Link href={`/${locale}/crm/invoices/new`}>
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0 h-9">
              <Plus className="w-4 h-4" />
              New Invoice
            </Button>
          </Link>
          <Link href={`/${locale}/crm/invoice-settings`}>
            <button
              type="button"
              className="h-9 w-9 rounded-lg border-2 border-black bg-black text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-gray-800 transition-colors font-medium"
              aria-label="Invoice settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
      <div className={`flex flex-wrap items-center gap-4 pb-2 ${crmChrome?.searchOpen ? 'max-md:hidden' : ''}`}>
        <form className="flex gap-2 items-center" onSubmit={(e) => e.preventDefault()}>
          <label className="text-sm text-gray-600">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 border border-gray-300 rounded-md text-sm bg-white text-black"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{invoiceStatusLabel(s)}</option>
            ))}
          </select>
        </form>
      </div>
      <AdminDataTable
        columnOrderKey="crm-invoices"
        exportName="invoices"
        columns={INVOICE_COLUMNS}
        data={invoices}
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
        searchPlaceholder="Search invoice or customer…"
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        error={error}
        getRowId={(row) => row.id}
        getCellText={invoiceCellText}
        renderCell={(row, columnId) => invoiceCellText(row, columnId) || '—'}
        onRowClick={(row) => router.push(`/${locale}/crm/invoices/${row.id}`)}
        renderActions={(row) => (
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
        )}
        bulkActions={{
          onDelete: (ids) => setBulkDeleteIds(ids),
          onCopyAsJson: (rows) => { void navigator.clipboard.writeText(JSON.stringify(rows, null, 2)); },
          onEdit: (row) => router.push(`/${locale}/crm/invoices/${row.id}`),
        }}
        emptyMessage="No invoices found."
        itemLabel="invoices"
        primaryColumnId="invoice_number"
      />

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete invoice?</h2>
            <p className="text-gray-600 mb-6">Only draft invoices can be deleted. This cannot be undone.</p>
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
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete invoices?</h2>
            <p className="text-gray-600 mb-6">Only draft invoices can be deleted. This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setBulkDeleteIds(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void handleBulkDeleteConfirm()} disabled={deleting}>{deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length}`}</Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const row = invoices.find((i) => i.id === openActionsId);
            const isDraft = row?.status === 'draft';
            return (
              <div
                ref={actionsMenuRef}
                className="fixed z-[100] min-w-[120px] py-1 bg-white border border-gray-200 rounded-md shadow-lg"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                  onClick={() => { router.push(`/${locale}/crm/invoices/${openActionsId}`); setOpenActionsId(null); setMenuPosition(null); }}
                >
                  <Pencil className="w-3.5 h-3.5" /> View / Edit
                </button>
                {isDraft && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      if (row) setDeleteConfirm({ id: row.id, label: row.invoice_number });
                      setOpenActionsId(null);
                      setMenuPosition(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
}
