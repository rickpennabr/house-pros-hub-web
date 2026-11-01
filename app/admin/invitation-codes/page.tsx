'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';

type InvitationRole = 'contractor' | 'realtor' | 'installer';

interface InvitationCodeRow {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

function codeStatus(row: InvitationCodeRow): string {
  if (row.used_at) return 'Used';
  if (new Date(row.expires_at) <= new Date()) return 'Expired';
  return 'Unused';
}

const CODE_COLUMNS: AdminDataTableColumn<InvitationCodeRow>[] = [
  { id: 'code', label: 'Code', width: 160 },
  { id: 'created_at', label: 'Created', width: 180 },
  { id: 'expires_at', label: 'Expires', width: 180 },
  { id: 'status', label: 'Status', width: 120 },
  { id: 'used_at', label: 'Used', width: 180 },
];

function codeCellText(row: InvitationCodeRow, columnId: string): string {
  switch (columnId) {
    case 'code':
      return row.code;
    case 'created_at':
      return formatDate(row.created_at);
    case 'expires_at':
      return formatDate(row.expires_at);
    case 'status':
      return codeStatus(row);
    case 'used_at':
      return row.used_at ? formatDate(row.used_at) : '';
    default:
      return '';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InvitationCodesPage() {
  const [role, setRole] = useState<InvitationRole>('contractor');
  const [codes, setCodes] = useState<InvitationCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<{ code: string; expiresAt: string; role: InvitationRole } | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invitation-codes?limit=50&role=${role}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to load codes');
      }
      const data = await res.json();
      setCodes(data.codes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load codes');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNewCode(null);
    try {
      const res = await fetch('/api/admin/invitation-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate code');
      setNewCode({ code: data.code, expiresAt: data.expiresAt, role: data.role ?? role });
      await fetchCodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(null);
    }
  };

  const roleLabel = role === 'realtor' ? 'Realtor' : role === 'installer' ? 'Installer' : 'Contractor';

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-black mb-2">Invitation codes</h1>
          <p className="text-gray-600 mb-3">
            Generate one-time codes for contractor, realtor, or installer signup. Each code expires in 30 days.
          </p>
          <div className="flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setRole('contractor')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                role === 'contractor'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Contractor
            </button>
            <button
              type="button"
              onClick={() => setRole('realtor')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                role === 'realtor'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Realtor
            </button>
            <button
              type="button"
              onClick={() => setRole('installer')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                role === 'installer'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Installer
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg border-2 border-black bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer shrink-0"
        >
          {generating ? 'Generating…' : `Generate ${roleLabel} code`}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

      {newCode && newCode.role === role && (
        <div className="mb-6 p-4 border-2 border-black rounded-lg bg-gray-50 flex flex-col gap-2">
          <p className="font-medium text-black">
            New {roleLabel.toLowerCase()} code created — give this to the {roleLabel.toLowerCase()}:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="px-3 py-2 bg-white border border-gray-300 rounded font-mono text-lg">
              {newCode.code}
            </code>
            <button
              type="button"
              onClick={() => copyCode(newCode.code)}
              className={`px-3 py-2 rounded border-2 text-sm font-medium cursor-pointer transition-all duration-300 ease-out min-w-[4.5rem] ${
                copiedCode === newCode.code
                  ? 'border-green-600 bg-green-600 text-white scale-105'
                  : 'border-black bg-white text-black hover:bg-gray-100'
              }`}
            >
              {copiedCode === newCode.code ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-gray-600">Expires: {formatDate(newCode.expiresAt)}</p>
        </div>
      )}

      <AdminDataTable
        clientSide
        columnOrderKey="admin-invitation-codes"
        exportName="invitation-codes"
        columns={CODE_COLUMNS}
        data={codes}
        total={codes.length}
        pageSize={50}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={null}
        getRowId={(row) => row.id}
        getCellText={codeCellText}
        searchPlaceholder="Search codes..."
        emptyMessage={`No ${role} invitation codes yet. Generate one above.`}
        itemLabel="codes"
        primaryColumnId="code"
        renderCell={(row, columnId) => {
          if (columnId === 'code') return <span className="font-mono text-sm">{row.code}</span>;
          if (columnId === 'status') {
            const status = codeStatus(row);
            const className = status === 'Unused' ? 'text-green-600 font-medium' : 'text-gray-600';
            return <span className={className}>{status}</span>;
          }
          return codeCellText(row, columnId) || '—';
        }}
      />
    </div>
  );
}
