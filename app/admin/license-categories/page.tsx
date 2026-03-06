'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, MoreVertical, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';

interface LicenseCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_contractor_license: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const ACTIONS_COLUMN_WIDTH = 72;
const MENU_HEIGHT = 80;

export default function LicenseCategoriesPage() {
  const [categories, setCategories] = useState<LicenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<LicenseCategory | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', requires_contractor_license: false, sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; code: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/license-categories', { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to load categories');
      }
      const data = await res.json();
      setCategories(data.categories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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

  /** All categories sorted for display (same order as signup). */
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '', requires_contractor_license: false, sort_order: categories.length });
    setModal('add');
    setSaveError(null);
  };

  const openEdit = (cat: LicenseCategory) => {
    setEditing(cat);
    setForm({
      code: cat.code,
      name: cat.name,
      description: cat.description ?? '',
      requires_contractor_license: cat.requires_contractor_license,
      sort_order: cat.sort_order,
    });
    setModal('edit');
    setSaveError(null);
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setSaveError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const url = modal === 'edit' && editing ? `/api/admin/license-categories/${editing.id}` : '/api/admin/license-categories';
      const method = modal === 'edit' ? 'PATCH' : 'POST';
      const body = modal === 'edit'
        ? { code: form.code, name: form.name, description: form.description || null, requires_contractor_license: form.requires_contractor_license, sort_order: form.sort_order }
        : { code: form.code, name: form.name, description: form.description || null, requires_contractor_license: form.requires_contractor_license, sort_order: form.sort_order };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      await fetchCategories();
      closeModal();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/license-categories/${deleteConfirm.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
      setDeleteConfirm(null);
      await fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">License categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage license type categories shown in signup and business forms (e.g. Handyman, Licensed Contractor).
          </p>
        </div>
        <div className="md:hidden h-9 px-4 rounded-md border-2 border-black bg-white flex items-center justify-center shrink-0 text-sm font-medium text-black">
          {sortedCategories.length} categor{sortedCategories.length !== 1 ? 'ies' : 'y'}
        </div>
        <Button
          variant="primary"
          size="sm"
          className="hidden md:flex items-center gap-2 shrink-0"
          onClick={openAdd}
        >
          <Plus className="w-4 h-4" />
          Add category
        </Button>
      </div>
      <AdminFloatingAddButton onClick={openAdd} ariaLabel="Add license category" />

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: 500 }}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
                <col style={{ width: ACTIONS_COLUMN_WIDTH, minWidth: ACTIONS_COLUMN_WIDTH }} />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-black bg-black text-white">
                  <th className="px-4 py-1.5 text-left border-r border-white font-semibold text-white whitespace-nowrap">Code</th>
                  <th className="px-4 py-1.5 text-left border-r border-white font-semibold text-white whitespace-nowrap">Name</th>
                  <th className="px-4 py-1.5 text-left border-r border-white font-semibold text-white whitespace-nowrap">Description</th>
                  <th className="px-4 py-1.5 text-left border-r border-white font-semibold text-white whitespace-nowrap">Requires contractor license</th>
                  <th className="px-4 py-1.5 text-left border-r border-white font-semibold text-white whitespace-nowrap">Order</th>
                  <th className="sticky right-0 z-10 py-1.5 text-center bg-black border-l-2 border-white shadow-[-4px_0_8px_rgba(0,0,0,0.15)] box-border" style={{ paddingLeft: 10, paddingRight: 10, width: ACTIONS_COLUMN_WIDTH }}>
                    <span className="font-semibold text-white whitespace-nowrap">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                      No license categories yet. Add one above.
                    </td>
                  </tr>
                ) : (
                  sortedCategories.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEdit(row);
                        }
                      }}
                      className="group border-b border-gray-100 hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-1.5 font-mono text-sm text-gray-900 max-w-0 overflow-hidden">
                        <span className="truncate block">{row.code}</span>
                      </td>
                      <td className="px-4 py-1.5 max-w-0 overflow-hidden">
                        <span className="font-medium text-gray-900 truncate block">{row.name}</span>
                      </td>
                      <td className="px-4 py-1.5 text-sm text-gray-600 max-w-0 overflow-hidden">
                        <span className="truncate block">{row.description ?? '—'}</span>
                      </td>
                      <td className="px-4 py-1.5 text-sm text-gray-600 max-w-0 overflow-hidden">
                        <span className="truncate block">{row.requires_contractor_license ? 'Yes' : 'No'}</span>
                      </td>
                      <td className="px-4 py-1.5 text-sm text-gray-500 max-w-0 overflow-hidden">
                        <span className="truncate block">{row.sort_order}</span>
                      </td>
                      <td
                        className="sticky right-0 z-10 py-1.5 text-center bg-white group-hover:bg-gray-50/80 border-l-2 border-gray-100 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] box-border"
                        style={{ paddingLeft: 10, paddingRight: 10 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative flex justify-center items-center w-full">
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
                              const left = Math.min(rect.right - 120, window.innerWidth - 130);
                              const spaceBelow = window.innerHeight - rect.bottom - 4;
                              const top = spaceBelow >= MENU_HEIGHT ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4;
                              setMenuPosition({ top, left });
                              setOpenActionsId(row.id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
                            aria-label="Actions"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="bg-white rounded-lg border-2 border-black shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">{modal === 'add' ? 'Add license category' : 'Edit license category'}</h2>
            {saveError && <p className="mb-3 text-red-600 text-sm">{saveError}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code (e.g. HANDYMAN, APPRENTICE)</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="HANDYMAN"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Handyman"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="No contractor license required. Nevada Business License only."
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires_contractor_license"
                  checked={form.requires_contractor_license}
                  onChange={(e) => setForm((f) => ({ ...f, requires_contractor_license: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="requires_contractor_license" className="text-sm text-gray-700">
                  Requires contractor license (show license classification + number)
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                  min={0}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : modal === 'add' ? 'Add' : 'Save'}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={closeModal} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete license category?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong className="text-gray-900">{deleteConfirm.code} – {deleteConfirm.name}</strong>?
              Businesses using it may need to be updated.
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
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={actionsMenuRef}
            className="fixed z-[100] min-w-[120px] py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionsId(null);
                setMenuPosition(null);
                const row = sortedCategories.find((c) => c.id === openActionsId);
                if (row) openEdit(row);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 hover:text-red-700 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const row = sortedCategories.find((c) => c.id === openActionsId);
                if (row) {
                  setDeleteConfirm({ id: row.id, code: row.code, name: row.name });
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
