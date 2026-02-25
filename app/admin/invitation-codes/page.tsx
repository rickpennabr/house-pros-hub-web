'use client';

import { useState, useEffect, useCallback } from 'react';

interface InvitationCodeRow {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
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
  const [codes, setCodes] = useState<InvitationCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<{ code: string; expiresAt: string } | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/invitation-codes?limit=50');
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
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNewCode(null);
    try {
      const res = await fetch('/api/admin/invitation-codes/generate', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate code');
      setNewCode({ code: data.code, expiresAt: data.expiresAt });
      await fetchCodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-black mb-2">Invitation codes</h1>
          <p className="text-gray-600">
            Generate one-time codes for contractor signup. Each code expires in 30 days.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg border-2 border-black bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer shrink-0"
        >
          {generating ? 'Generating…' : 'Generate code'}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

      {newCode && (
        <div className="mb-6 p-4 border-2 border-black rounded-lg bg-gray-50 flex flex-col gap-2">
          <p className="font-medium text-black">New code created — give this to the contractor:</p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="px-3 py-2 bg-white border border-gray-300 rounded font-mono text-lg">
              {newCode.code}
            </code>
            <button
              type="button"
              onClick={() => copyCode(newCode.code)}
              className="px-3 py-2 rounded border-2 border-black bg-white text-black text-sm font-medium hover:bg-gray-100 cursor-pointer"
            >
              Copy
            </button>
          </div>
          <p className="text-sm text-gray-600">Expires: {formatDate(newCode.expiresAt)}</p>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {loading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="p-6 text-gray-500">No invitation codes yet. Generate one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-semibold text-black">Code</th>
                  <th className="px-4 py-3 font-semibold text-black">Created</th>
                  <th className="px-4 py-3 font-semibold text-black">Expires</th>
                  <th className="px-4 py-3 font-semibold text-black">Status</th>
                  <th className="px-4 py-3 font-semibold text-black">Used</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-sm">{row.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.expires_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.used_at ? (
                        <span className="text-gray-600">Used</span>
                      ) : new Date(row.expires_at) <= new Date() ? (
                        <span className="text-gray-500">Expired</span>
                      ) : (
                        <span className="text-green-600 font-medium">Unused</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.used_at ? formatDate(row.used_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
