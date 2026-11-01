'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { AdminRepairPushButton } from '@/components/notifications/AdminRepairPushButton';
import type { AdminEstimateRow } from '@/app/api/admin/estimates/route';

const COLUMNS: AdminDataTableColumn<AdminEstimateRow>[] = [
  { id: 'name', label: 'Name', width: 180 },
  { id: 'email', label: 'Email', width: 220 },
  { id: 'phone', label: 'Phone', width: 140 },
  { id: 'location', label: 'Location', width: 160 },
  { id: 'project_type', label: 'Project', width: 160 },
  { id: 'source', label: 'Source', width: 100 },
  { id: 'created_at', label: 'Submitted', width: 140 },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function cellText(row: AdminEstimateRow, columnId: string): string {
  if (columnId === 'created_at') return formatDate(row.created_at);
  const value = row[columnId as keyof AdminEstimateRow];
  return typeof value === 'string' ? value : '';
}

export default function AdminEstimatesPage() {
  const [rows, setRows] = useState<AdminEstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black mb-2">Estimates</h1>
        <p className="text-gray-600">Estimate requests sent to the site.</p>
      </div>
      <AdminRepairPushButton />
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
        renderCell={(row, columnId) => cellText(row, columnId) || '—'}
      />
    </div>
  );
}
