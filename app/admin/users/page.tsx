'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import type { AdminUserRow } from '@/app/api/admin/users/route';

const ROLE_FILTERS = ['all', 'admin', 'customer', 'contractor', 'realtor', 'installer', 'handyman'] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const EDITABLE_ROLES = [
  { value: 'customer', label: 'Customer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'installer', label: 'Installer' },
  { value: 'handyman', label: 'Handyman' },
] as const;

type ViewMode = 'table' | 'edit';

type UserEditForm = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  businessId: string | null;
  businessName: string;
  role: string;
  isActive: boolean;
};

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

function UserEditFormView({
  initial,
  onCancel,
  onSuccess,
}: {
  initial: UserEditForm;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<UserEditForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof UserEditForm>(key: K, value: UserEditForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          businessName: form.businessName.trim(),
          role: form.role,
          isActive: form.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update user');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="md:p-6 space-y-4 max-w-xl md:mx-auto">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="First name" required>
          <Input
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            required
          />
        </FormField>
        <FormField label="Last name" required>
          <Input
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            required
          />
        </FormField>
      </div>

      <FormField label="Email" required>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          required
        />
      </FormField>

      <FormField label="Phone">
        <Input
          type="tel"
          value={form.phone}
          onChange={(e) => update('phone', formatPhoneNumber(e.target.value))}
          placeholder="(702) 555-0100"
        />
      </FormField>

      {form.businessId ? (
        <FormField label="Business name">
          <Input
            value={form.businessName}
            onChange={(e) => update('businessName', e.target.value)}
          />
        </FormField>
      ) : null}

      <FormField label="Role" required>
        <Select
          value={form.role}
          onChange={(e) => update('role', e.target.value)}
          required
        >
          {EDITABLE_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Active">
        <label className="inline-flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => update('isActive', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Account is active
        </label>
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<UserEditForm | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUserRow | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [skippedAdmin, setSkippedAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const MENU_HEIGHT = 88;

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
    if (viewMode !== 'edit' || !editingId) return;
    let cancelled = false;
    setEditingInitial(null);
    setError(null);
    fetch(`/api/admin/users/${editingId}`, { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Failed to load user');
          setViewMode('table');
          setEditingId(null);
          return;
        }
        setEditingInitial({
          id: data.id,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          businessId: data.businessId ?? null,
          businessName: data.businessName ?? '',
          role: data.role ?? 'customer',
          isActive: data.isActive !== false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load user');
          setViewMode('table');
          setEditingId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, editingId]);

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

  const openEdit = (row: AdminUserRow) => {
    if (isAdminAccount(row)) return;
    setOpenActionsId(null);
    setMenuPosition(null);
    setEditingId(row.id);
    setViewMode('edit');
  };

  const closeEdit = () => {
    setViewMode('table');
    setEditingId(null);
    setEditingInitial(null);
  };

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

  if (viewMode === 'edit') {
    return (
      <div className="w-full md:max-w-2xl md:mx-auto">
        <div className="py-2 md:py-0 md:mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={closeEdit}
            className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer"
            aria-label="Back to users"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span className="hidden md:inline">Back</span>
          </button>
          <span className="text-lg md:text-xl font-semibold text-gray-900">Edit user</span>
        </div>
        {editingInitial ? (
          <UserEditFormView
            initial={editingInitial}
            onCancel={closeEdit}
            onSuccess={() => {
              closeEdit();
              void load(true);
            }}
          />
        ) : (
          <div className="p-12 text-center text-gray-500 text-sm">Loading user…</div>
        )}
      </div>
    );
  }

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
        onRowClick={(row) => openEdit(row)}
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
                const top = window.innerHeight - rect.bottom >= MENU_HEIGHT ? rect.bottom + 4 : rect.top - MENU_HEIGHT;
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
          onEdit: (row) => openEdit(row),
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
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-4">
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
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-4">
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700 cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                const row = users.find((user) => user.id === openActionsId);
                if (row) openEdit(row);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
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
