'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';

const ITEM_COLUMNS: AdminDataTableColumn<ProCrmItem>[] = [
  { id: 'name', label: 'Name', width: 180 },
  { id: 'item_type', label: 'Type', width: 110 },
  { id: 'description', label: 'Description', width: 260, wrap: true },
  { id: 'unit', label: 'Unit', width: 90 },
  { id: 'price_cents', label: 'Rate', width: 110 },
  { id: 'sku', label: 'SKU', width: 120 },
  { id: 'category', label: 'Category', width: 140 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function itemCellText(item: ProCrmItem, columnId: string): string {
  switch (columnId) {
    case 'name':
      return item.name;
    case 'item_type':
      return item.item_type;
    case 'description':
      return item.description ?? '';
    case 'unit':
      return item.unit || '';
    case 'price_cents':
      return formatCurrency(item.price_cents);
    case 'sku':
      return item.sku ?? '';
    case 'category':
      return item.category ?? '';
    default:
      return '';
  }
}

export default function CRMItemsPage() {
  const [items, setItems] = useState<ProCrmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProCrmItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProCrmItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/crm/items', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load products/services');
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products/services');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (item: ProCrmItem) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/items/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete item');
      setItems((prev) => prev.filter((existingItem) => existingItem.id !== item.id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
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
        const res = await fetch(`/api/crm/items/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to delete item');
      }
      setItems((prev) => prev.filter((item) => !bulkDeleteIds.includes(item.id)));
      setBulkDeleteIds(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete items');
    } finally {
      setDeleting(false);
    }
  };

  const getDuplicateName = (baseName: string) => {
    const normalizedExistingNames = new Set(items.map((item) => item.name.trim().toLowerCase()));
    const plainCopy = `${baseName} (Copy)`;
    if (!normalizedExistingNames.has(plainCopy.trim().toLowerCase())) return plainCopy;
    let copyIndex = 2;
    while (copyIndex < 500) {
      const numberedCopy = `${baseName} (Copy ${copyIndex})`;
      if (!normalizedExistingNames.has(numberedCopy.trim().toLowerCase())) return numberedCopy;
      copyIndex += 1;
    }
    return `${baseName} (Copy ${Date.now()})`;
  };

  const handleDuplicate = async (item: ProCrmItem) => {
    setDuplicatingId(item.id);
    setError(null);
    try {
      const res = await fetch('/api/crm/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: getDuplicateName(item.name),
          item_type: item.item_type,
          sku: item.sku ?? undefined,
          category: item.category ?? undefined,
          description: item.description ?? undefined,
          price_cents: item.price_cents ?? 0,
          unit: item.unit || 'each',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate item');
      const duplicated = data as ProCrmItem;
      setItems((prev) => [...prev, duplicated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate item');
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Products & Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage reusable line items for estimates and invoices.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="flex items-center gap-2 shrink-0"
          onClick={() => {
            setEditingItem(null);
            setPanelOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          New Item
        </Button>
      </div>

      <div className="flex justify-end pb-2">
        <Button type="button" variant="secondary" size="sm" onClick={fetchItems}>
          Refresh
        </Button>
      </div>

      <AdminDataTable
        clientSide
        columnOrderKey="crm-items"
        exportName="products-services"
        columns={ITEM_COLUMNS}
        data={items}
        total={items.length}
        pageSize={25}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={error}
        getRowId={(row) => row.id}
        getCellText={itemCellText}
        renderCell={(row, columnId) => itemCellText(row, columnId) || '—'}
        onRowClick={(row) => { setEditingItem(row); setPanelOpen(true); }}
        searchPlaceholder="Search by name, description, type, SKU, category..."
        renderActions={(row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (openActionsId === row.id) {
                setOpenActionsId(null);
                setMenuPosition(null);
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: rect.bottom + 4, left: Math.min(rect.right - 140, window.innerWidth - 150) });
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
          onEdit: (row) => { setEditingItem(row); setPanelOpen(true); },
        }}
        emptyMessage="No products/services yet. Add your first reusable item."
        itemLabel="items"
        primaryColumnId="name"
      />

      <AddProductServicePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditingItem(null);
        }}
        existingItems={items}
        initialItem={editingItem}
        onSaved={(item) => {
          setItems((prev) => {
            const index = prev.findIndex((existingItem) => existingItem.id === item.id);
            if (index === -1) return [...prev, item];
            const next = [...prev];
            next[index] = item;
            return next;
          });
        }}
      />

      {openActionsId && menuPosition && typeof document !== 'undefined' && createPortal(
        <div className="fixed z-[100] min-w-[140px] rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={() => { const row = items.find((item) => item.id === openActionsId); if (row) { setEditingItem(row); setPanelOpen(true); } setOpenActionsId(null); }}>Edit</button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100" disabled={duplicatingId === openActionsId} onClick={() => { const row = items.find((item) => item.id === openActionsId); if (row) void handleDuplicate(row); setOpenActionsId(null); }}>Duplicate</button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100" onClick={() => { const row = items.find((item) => item.id === openActionsId); if (row) setDeleteConfirm(row); setOpenActionsId(null); }}>Delete</button>
        </div>,
        document.body
      )}

      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal isOpen onClose={() => !deleting && setBulkDeleteIds(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete items?</h2>
            <p className="text-gray-600 mb-6">Delete {bulkDeleteIds.length} item{bulkDeleteIds.length === 1 ? '' : 's'}? This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setBulkDeleteIds(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void handleBulkDeleteConfirm()} disabled={deleting}>{deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length}`}</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal
          isOpen
          onClose={() => !deleting && setDeleteConfirm(null)}
          showHeader={false}
          showCloseButton
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete item?</h2>
            <p className="text-gray-600 mb-6">
              This will remove <span className="font-semibold">{deleteConfirm.name}</span> from reusable items.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
