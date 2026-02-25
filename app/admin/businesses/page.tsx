'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreVertical,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { AdminBusinessRow } from '@/app/api/admin/businesses/route';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import type { AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 25;

type SortKey = 'created_at' | 'updated_at' | 'business_name' | 'email' | 'is_active' | 'is_verified';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const BUSINESS_COLUMNS: AdminDataTableColumn<AdminBusinessRow>[] = [
  { id: 'name', label: 'Name', sortKey: 'business_name' },
  { id: 'email', label: 'Email', sortKey: 'email' },
  { id: 'phone', label: 'Phone' },
  { id: 'status', label: 'Status' },
  { id: 'created', label: 'Created', sortKey: 'created_at' },
  { id: 'actions', label: 'Actions', resizable: false },
];

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<AdminBusinessRow[]>([]);
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

  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    businessName: string;
  } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const MENU_HEIGHT = 80;

  const fetchBusinesses = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    try {
      if (isFirstLoad) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/businesses?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBusinesses(data.businesses ?? []);
      setTotal(data.total ?? 0);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load businesses');
      if (isFirstLoad) {
        setBusinesses([]);
        setTotal(0);
      }
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [page, sortBy, sortDir, search]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      const inMenu = actionsMenuRef.current?.contains(target);
      const inButton = actionsButtonRef.current?.contains(target);
      if (!inMenu && !inButton) {
        setOpenActionsId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionsId]);

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortBy(key as SortKey);
    setSortDir(dir);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleDeleteBusiness = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchBusinesses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete business');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    setDeleting(true);
    setError(null);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/businesses/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed to delete ${id}`);
      }
      setBulkDeleteIds(null);
      fetchBusinesses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete businesses');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkCopyAsJson = (rows: AdminBusinessRow[]) => {
    const json = JSON.stringify(rows, null, 2);
    void navigator.clipboard.writeText(json);
  };

  const handleBulkEdit = (row: AdminBusinessRow) => {
    const slug = row.slug || row.id;
    window.open(`/en/business/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const renderCell = (row: AdminBusinessRow, columnId: string) => {
    switch (columnId) {
      case 'name':
        return row.business_name || '—';
      case 'email':
        return row.email || '—';
      case 'phone':
        return row.phone || row.mobile_phone || '—';
      case 'status':
        return (
          <span className="flex flex-wrap gap-1">
            <span
              className={`inline-flex px-2 py-0.5 text-xs rounded ${
                row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {row.is_active ? 'Active' : 'Inactive'}
            </span>
            <span
              className={`inline-flex px-2 py-0.5 text-xs rounded ${
                row.is_verified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {row.is_verified ? 'Verified' : 'Unverified'}
            </span>
          </span>
        );
      case 'created':
        return formatDate(row.created_at);
      default:
        return '—';
    }
  };

  const handleRowClick = (row: AdminBusinessRow) => {
    const slug = row.slug || row.id;
    window.open(`/en/business/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const renderActions = (row: AdminBusinessRow) => (
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
        const left = Math.min(rect.right - 140, window.innerWidth - 150);
        const spaceBelow = window.innerHeight - rect.bottom - 4;
        const top =
          spaceBelow >= MENU_HEIGHT ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4;
        setMenuPosition({ top, left });
        setOpenActionsId(row.id);
      }}
      className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
      aria-label="Actions"
    >
      <MoreVertical className="w-5 h-5" />
    </button>
  );

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Businesses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="md:hidden">Manage businesses.</span>
            <span className="hidden md:inline">
              View and manage contractor businesses.
            </span>
          </p>
        </div>
        <div className="md:hidden h-9 px-4 rounded-md border-2 border-black bg-white flex items-center justify-center shrink-0 text-sm font-medium text-black">
          {total} business{total !== 1 ? 'es' : ''}
        </div>
      </div>

      <AdminDataTable<AdminBusinessRow>
        columns={BUSINESS_COLUMNS}
        data={businesses}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder="Search by name, email…"
        isLoading={isLoading}
        isRefetching={isRefetching}
        hasLoadedOnce={hasLoadedOnce}
        error={error}
        getRowId={(row) => row.id}
        renderCell={renderCell}
        onRowClick={handleRowClick}
        renderActions={renderActions}
        bulkActions={{
          onDelete: (ids) => setBulkDeleteIds(ids),
          onCopyAsJson: handleBulkCopyAsJson,
          onEdit: handleBulkEdit,
        }}
        emptyMessage="No businesses found."
        itemLabel="businesses"
        primaryColumnId="name"
      />

      {/* Bulk delete confirmation modal */}
      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setBulkDeleteIds(null)}
          showHeader={false}
          showCloseButton={true}
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete businesses?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{bulkDeleteIds.length}</strong> business
              {bulkDeleteIds.length !== 1 ? 'es' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setBulkDeleteIds(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => handleBulkDelete(bulkDeleteIds)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length} business${bulkDeleteIds.length !== 1 ? 'es' : ''}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete business warning modal */}
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete business?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{' '}
              <strong className="text-gray-900">
                {deleteConfirm.businessName || 'this business'}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => handleDeleteBusiness(deleteConfirm.id)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete business'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Actions dropdown portal */}
      {openActionsId &&
        menuPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={actionsMenuRef}
            className="fixed z-[100] min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <a
              href={`/en/business/${businesses.find((b) => b.id === openActionsId)?.slug || openActionsId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer text-gray-900 no-underline"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionsId(null);
                setMenuPosition(null);
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View
            </a>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 hover:text-red-700 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const row = businesses.find((b) => b.id === openActionsId);
                if (row) {
                  setDeleteConfirm({
                    id: row.id,
                    businessName: row.business_name ?? '',
                  });
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
