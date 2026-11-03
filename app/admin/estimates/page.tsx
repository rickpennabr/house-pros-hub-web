'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, MoreVertical, Trash2 } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { AdminEstimateRow } from '@/app/api/admin/estimates/route';

const COLUMNS: AdminDataTableColumn<AdminEstimateRow>[] = [
  { id: 'name', label: 'Name', width: 180 },
  { id: 'email', label: 'Email', width: 220 },
  { id: 'phone', label: 'Phone', width: 140 },
  { id: 'location', label: 'Location', width: 160 },
  { id: 'project_type', label: 'Project', width: 160 },
  { id: 'source', label: 'Source', width: 140 },
  { id: 'created_at', label: 'Submitted', width: 140 },
  { id: 'actions', label: 'Actions', resizable: false },
];

interface EstimateDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  project_type: string;
  project_type_other: string | null;
  description: string;
  additional_notes: string | null;
  budget_range: string;
  timeline: string;
  preferred_contact_method: string;
  requires_hoa_approval: boolean;
  wants_3d: boolean;
  trades: string[];
  source: string;
  images: string[];
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function labelize(value: string) {
  return value.replaceAll('_', ' ');
}

function sourceLabel(source: string) {
  if (source === 'web') return 'estimate form';
  return source;
}

function cellText(row: AdminEstimateRow, columnId: string): string {
  if (columnId === 'created_at') return formatDate(row.created_at);
  if (columnId === 'source') return sourceLabel(row.source);
  const value = row[columnId as keyof AdminEstimateRow];
  return typeof value === 'string' ? value : '';
}

export default function AdminEstimatesPage() {
  const [rows, setRows] = useState<AdminEstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EstimateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/estimates', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load estimates');
      setRows(Array.isArray(data.estimates) ? data.estimates : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEstimate = useCallback(async (row: AdminEstimateRow) => {
    setOpenId(row.id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/estimates/${row.id}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load estimate');
      setDetail(data.estimate as EstimateDetail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load estimate');
    } finally {
      setDetailLoading(false);
    }
  }, []);

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

  const deleteEstimates = async (ids: string[]) => {
    setDeleting(true);
    setError(null);
    const failures: string[] = [];
    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/estimates/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) failures.push(typeof data.error === 'string' ? data.error : 'Failed to delete estimate');
      }
      setDeleteIds(null);
      if (openId && ids.includes(openId)) {
        setOpenId(null);
        setDetail(null);
      }
      await load(true);
      if (failures.length > 0) setError(failures[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estimate');
    } finally {
      setDeleting(false);
    }
  };

  const projectLabel = detail
    ? detail.project_type === 'other' && detail.project_type_other
      ? detail.project_type_other
      : labelize(detail.project_type)
    : '';

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black mb-2">Estimates</h1>
        <p className="text-gray-600">Estimate requests sent to the site. Click a row to open it.</p>
      </div>
      <AdminDataTable
        clientSide
        columnOrderKey="admin-estimates"
        exportName="estimates"
        columns={COLUMNS}
        data={rows}
        total={rows.length}
        pageSize={25}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={error}
        getRowId={(row) => row.id}
        getCellText={cellText}
        searchPlaceholder="Search estimates..."
        emptyMessage="No estimate requests yet."
        itemLabel="estimates"
        primaryColumnId="name"
        openOnFirstClick
        onRowClick={(row) => void openEstimate(row)}
        renderCell={(row, columnId) => cellText(row, columnId) || '—'}
        renderActions={(row) => (
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
        )}
        bulkActions={{
          onDelete: (ids) => setDeleteIds(ids),
        }}
      />

      <Modal
        isOpen={Boolean(openId)}
        onClose={() => {
          if (deleting) return;
          setOpenId(null);
          setDetail(null);
        }}
        showHeader
        title={detail?.name || 'Estimate'}
        maxWidth="lg"
        contentClassName="p-0"
      >
        <div className="p-4 space-y-4">
          {detailLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {detailError && <p className="text-sm text-red-600">{detailError}</p>}
          {detail && (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-black break-all">{detail.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-black">{detail.phone || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Address</dt>
                  <dd className="text-black">{detail.address || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Project</dt>
                  <dd className="text-black capitalize">{projectLabel || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Source</dt>
                  <dd className="text-black">{sourceLabel(detail.source) || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Budget</dt>
                  <dd className="text-black capitalize">{labelize(detail.budget_range) || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Timeline</dt>
                  <dd className="text-black capitalize">{labelize(detail.timeline) || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Contact</dt>
                  <dd className="text-black capitalize">{labelize(detail.preferred_contact_method) || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Submitted</dt>
                  <dd className="text-black">{formatDate(detail.created_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Trades</dt>
                  <dd className="text-black">{detail.trades.length > 0 ? detail.trades.join(', ') : '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">HOA approval</dt>
                  <dd className="text-black">{detail.requires_hoa_approval ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">3D</dt>
                  <dd className="text-black">{detail.wants_3d ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-sm text-black whitespace-pre-wrap">{detail.description || '—'}</p>
              </div>
              {detail.additional_notes ? (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-black whitespace-pre-wrap">{detail.additional_notes}</p>
                </div>
              ) : null}
              {detail.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {detail.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                      <img src={url} alt="" className="w-full h-28 object-cover rounded-lg border-2 border-black" />
                    </a>
                  ))}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => setDeleteIds([detail.id])}
              >
                Delete estimate
              </Button>
            </>
          )}
        </div>
      </Modal>

      {deleteIds && deleteIds.length > 0 && (
        <Modal
          isOpen
          onClose={() => !deleting && setDeleteIds(null)}
          showHeader={false}
          showCloseButton
          maxWidth="sm"
          preventCloseOnOverlayClick={deleting}
        >
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Delete {deleteIds.length === 1 ? 'estimate' : 'estimates'}?
            </h2>
            <p className="text-gray-600 mb-6">
              This permanently removes <strong>{deleteIds.length}</strong> estimate
              {deleteIds.length === 1 ? '' : 's'}. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={() => setDeleteIds(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
                onClick={() => void deleteEstimates(deleteIds)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : `Delete ${deleteIds.length}`}
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                const id = openActionsId;
                setOpenActionsId(null);
                setMenuPosition(null);
                if (id) setDeleteIds([id]);
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
