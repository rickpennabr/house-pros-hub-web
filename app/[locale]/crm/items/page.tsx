'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';

export default function CRMItemsPage() {
  const [items, setItems] = useState<ProCrmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProCrmItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProCrmItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [openMobileActionsId, setOpenMobileActionsId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!openMobileActionsId) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-mobile-actions-root="true"]')) {
        setOpenMobileActionsId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMobileActionsId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMobileActionsId]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        (item.description ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.sku ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.category ?? '').toLowerCase().includes(normalizedQuery) ||
        item.item_type.toLowerCase().includes(normalizedQuery) ||
        item.unit.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [items, query]);

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

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

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

      <div className="flex items-center gap-2 pb-2">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, description, type, SKU, category..."
            className="pl-9 h-9"
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={fetchItems}>
          Refresh
        </Button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-900 text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">Loading items...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    {query.trim() ? 'No matching items.' : 'No products/services yet. Add your first reusable item.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 text-sm">
                    <td className="px-3 py-2 font-medium text-gray-900">{item.name}</td>
                    <td className="px-3 py-2 capitalize">{item.item_type}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[260px] truncate" title={item.description ?? ''}>
                      {(item.description ?? '').trim() || '—'}
                    </td>
                    <td className="px-3 py-2">{item.unit || '—'}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.price_cents)}</td>
                    <td className="px-3 py-2">{(item.sku ?? '').trim() || '—'}</td>
                    <td className="px-3 py-2">{(item.category ?? '').trim() || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="hidden md:flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-md inline-flex items-center justify-center"
                          onClick={() => {
                            setEditingItem(item);
                            setPanelOpen(true);
                            setOpenMobileActionsId(null);
                          }}
                          title="Edit item"
                        >
                          <span className="text-base leading-none" aria-hidden="true">✎</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-md inline-flex items-center justify-center"
                          onClick={() => handleDuplicate(item)}
                          disabled={duplicatingId === item.id}
                          title="Duplicate item"
                        >
                          <span className="text-base leading-none" aria-hidden="true">⧉</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-md inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => setDeleteConfirm(item)}
                          title="Delete item"
                        >
                          <span className="text-base leading-none" aria-hidden="true">🗑</span>
                        </Button>
                      </div>
                      <div className="md:hidden flex justify-end">
                        <div className="relative" data-mobile-actions-root="true">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-md inline-flex items-center justify-center"
                            onClick={() => setOpenMobileActionsId((prev) => (prev === item.id ? null : item.id))}
                            title="Actions"
                          >
                            <span className="text-lg leading-none" aria-hidden="true">⋮</span>
                          </Button>
                          {openMobileActionsId === item.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg">
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                onClick={() => {
                                  setEditingItem(item);
                                  setPanelOpen(true);
                                  setOpenMobileActionsId(null);
                                }}
                              >
                                <span className="text-sm leading-none" aria-hidden="true">✎</span>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                disabled={duplicatingId === item.id}
                                onClick={() => {
                                  handleDuplicate(item);
                                  setOpenMobileActionsId(null);
                                }}
                              >
                                <span className="text-sm leading-none" aria-hidden="true">⧉</span>
                                Duplicate
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                                onClick={() => {
                                  setDeleteConfirm(item);
                                  setOpenMobileActionsId(null);
                                }}
                              >
                                <span className="text-sm leading-none" aria-hidden="true">🗑</span>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
