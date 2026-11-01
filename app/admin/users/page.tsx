'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, MoreVertical, Trash2 } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { AdminUserRow } from '@/app/api/admin/users/route';

const ROLE_FILTERS = ['all', 'admin', 'customer', 'contractor', 'realtor', 'installer'] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const USER_COLUMNS: AdminDataTableColumn<AdminUserRow>[] = [
  { id: 'name', label: 'Name', width: 180 },
  { id: 'email', label: 'Email', width: 240 },
  { id: 'roles', label: 'Role', width: 160 },
  { id: 'business', label: 'Business', width: 200 },
  { id: 'active', label: 'Active', width: 90 },
  { id: 'joined', label: 'Joined', width: 140 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function displayName(row: AdminUserRow) {
  return `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || 'this user';
}

function isAdminAccount(row: AdminUserRow) {
  return row.roles.includes('admin');
}

function userCellText(row: AdminUserRow, columnId: string): string {
  switch (columnId) {
    case 'name':
      return `${row.first_name || ''} ${row.last_name || ''}`.trim();
    case 'email':
      return row.email || '';
    case 'roles':
      return row.roles.join(', ');
    case 'business':
      return row.business_name || '';
    case 'active':
      return row.is_active ? 'Yes' : 'No';
    case 'joined':
      return formatDate(row.created_at);
    default:
      return '';
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>('all');
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUserRow | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [skippedAdmin, setSkippedAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load users');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionsMenuRef.current?.contains(target) || actionsButtonRef.current?.contains(target)) return;
      setOpenActionsId(null);
      setMenuPosition(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionsId]);

  const shown = role === 'all' ? users : users.filter((user) => user.roles.includes(role));

  const deleteUsers = async (ids: string[]) => {
    setDeleting(true);
    setError(null);
    const failures: string[] = [];
    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) failures.push(typeof data.error === 'string' ? data.error : 'Failed to delete user');
      }
      setDeleteConfirm(null);
      setBulkDeleteIds(null);
      setSkippedAdmin(false);
      await load(true);
      if (failures.length > 0) setError(failures[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const requestBulkDelete = (ids: string[]) => {
    const allowed = ids.filter((id) => {
      const row = users.find((user) => user.id === id);
      return row && !isAdminAccount(row);
    });
    if (allowed.length === 0) {
      setError('The admin account cannot be deleted.');
      return;
    }
    setError(null);
    setSkippedAdmin(allowed.length !== ids.length);
    setBulkDeleteIds(allowed);
  };

  return (
    <div className="w-full">
      <div className="mb-2 md:mb-6">
        <div className="hidden md:block">
          <h1 className="text-3xl font-semibold text-black mb-2">Users</h1>
          <p className="text-gray-600 mb-3">
            Everyone on House Pros Hub. The admin account is listed as admin.
          </p>
        </div>
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {ROLE_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize whitespace-nowrap ${
                role === item ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {item === 'all' ? 'All' : item}
            </button>
          ))}
        </div>
      </div>

      <AdminDataTable
        clientSide
        columnOrderKey="admin-users"
        exportName="users"
        columns={USER_COLUMNS}
        data={shown}
        total={shown.length}
        pageSize={25}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={error}
        getRowId={(row) => row.id}
        getCellText={userCellText}
        searchPlaceholder="Search users..."
        emptyMessage="No users in this role."
        itemLabel="users"
        primaryColumnId="name"
        renderCell={(row, columnId) => userCellText(row, columnId) || '—'}
        renderActions={(row) =>
          isAdminAccount(row) ? null : (
            <button
              ref={openActionsId === row.id ? actionsButtonRef : undefined}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (openActionsId === row.id) {
                  setOpenActionsId(null);
                  setMenuPosition(null);
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                actionsButtonRef.current = event.currentTarget;
                const left = Math.min(rect.right - 120, window.innerWidth - 130);
                const top = window.innerHeight - rect.bottom >= 48 ? rect.bottom + 4 : rect.top - 48;
                setMenuPosition({ top, left });
                setOpenActionsId(row.id);
              }}
              className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
              aria-label="Actions"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          )
        }
        bulkActions={{
          onDelete: requestBulkDelete,
          onCopyAsJson: (rows) => {
            void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
          },
        }}
      />

      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal
          isOpen
          onClose={() => !deleting && setBulkDeleteIds(null)}
          showHeader={false}
          showCloseButton
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete users?</h2>
            <p className="text-gray-600 mb-6">
              This permanently removes <strong>{bulkDeleteIds.length}</strong> account
              {bulkDeleteIds.length !== 1 ? 's' : ''} and anything they own, including their business.
              This cannot be undone.
              {skippedAdmin ? ' The admin account is not included.' : ''}
            </p>
            <div className="flex gap-3 justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={() => setBulkDeleteIds(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => void deleteUsers(bulkDeleteIds)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length}`}
              </Button>
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
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete user?</h2>
            <p className="text-gray-600 mb-6">
              This permanently removes <strong className="text-gray-900">{displayName(deleteConfirm)}</strong> and
              anything they own, including their business. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => void deleteUsers([deleteConfirm.id])}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete user'}
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 hover:text-red-700 cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                const row = users.find((user) => user.id === openActionsId);
                setOpenActionsId(null);
                setMenuPosition(null);
                if (row && !isAdminAccount(row)) setDeleteConfirm(row);
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
