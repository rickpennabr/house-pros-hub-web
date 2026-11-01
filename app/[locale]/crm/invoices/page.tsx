'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronDown, Plus, Pencil, Trash2, MoreVertical, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { formatInvoiceDueDisplay } from '@/lib/invoices/invoiceDueOnReceipt';
import { invoiceStatusLabel } from '@/lib/crm/invoice-books';

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

export default function CRMInvoicesPage() {
  const router = useRouter();
  const locale = useLocale();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
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
  }, [page, sortBy, sortDir, statusFilter]);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
              <option key={s} value={s}>{invoiceStatusLabel(s)}</option>
            ))}
          </select>
        </form>
      </div>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {isLoading && !hasLoadedOnce ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading invoices…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 560 }}>
              <thead>
                <tr className="border-b-2 border-black bg-black text-white">
                  <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                    <SortHeader label="Invoice #" sortKey="invoice_number" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">Customer</th>
                  <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                    <SortHeader label="Amount" sortKey="amount_cents" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                    <SortHeader label="Status" sortKey="status" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                    <SortHeader label="Due" sortKey="due_date" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-1.5 text-left border-r border-white whitespace-nowrap">
                    <SortHeader label="Invoice date" sortKey="invoice_date" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="sticky right-0 z-10 py-1.5 text-center bg-black border-l-2 border-white w-[72px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">No invoices found.</td></tr>
                ) : (
                  invoices.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/${locale}/crm/invoices/${row.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/${locale}/crm/invoices/${row.id}`); } }}
                      className="group border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                    >
                      <td className="px-4 py-1.5 font-medium text-gray-900">{row.invoice_number}</td>
                      <td className="px-4 py-1.5 text-sm text-gray-700">
                        {[row.customerFirstName, row.customerLastName].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-1.5 text-sm text-gray-600">{formatAmount(row.amount_cents)}</td>
                      <td className="px-4 py-1.5 text-sm text-gray-600">{invoiceStatusLabel(row.status)}</td>
                      <td className="px-4 py-1.5 text-sm text-gray-500">
                        {formatInvoiceDueDisplay(row.invoice_date, row.due_date, row.payment_terms, formatDate)}
                      </td>
                      <td className="px-4 py-1.5 text-sm text-gray-500">{formatDate(row.invoice_date)}</td>
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
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={PAGE_SIZE} itemLabel="invoices" />
        </div>
      )}

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
