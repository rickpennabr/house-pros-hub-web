'use client';

import { useCallback, useEffect, useState } from 'react';

interface AgentAppRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
}

export default function AgentAppsPage() {
  const [apps, setApps] = useState<AgentAppRow[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/agent-apps');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load agent apps');
      setApps(data.apps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const createApp = async () => {
    setSaving(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch('/api/admin/agent-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to create agent app');
      setNewKey(data.apiKey ?? null);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent app');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/agent-apps/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke agent app');
      setConfirmRevokeId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke agent app');
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black mb-2">Agent apps</h1>
        <p className="text-gray-600">
          Create a key for an assistant that searches pros and opens estimate requests. The key is shown once.
        </p>
      </div>

      <form
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void createApp();
        }}
      >
        <label className="flex-1 text-sm font-medium text-black">
          App name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            placeholder="Homeowner assistant"
            className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={saving || name.trim().length === 0}
          className="px-4 py-2 rounded-lg border-2 border-black bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer"
        >
          {saving ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {newKey && (
        <div className="mb-6 rounded-lg border-2 border-black bg-white p-4">
          <p className="text-sm font-medium text-black mb-2">Copy this key now. It is not shown again.</p>
          <code className="block break-all text-sm mb-3">{newKey}</code>
          <button
            type="button"
            onClick={() => void copyKey()}
            className="px-3 py-1.5 rounded-lg border-2 border-black text-sm font-medium cursor-pointer"
          >
            {copied ? 'Copied' : 'Copy key'}
          </button>
        </div>
      )}

      {error && (
        <p className="mb-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-gray-600 text-sm">Loading…</p>
      ) : apps.length === 0 ? (
        <p className="text-gray-600 text-sm">No agent apps yet.</p>
      ) : (
        <ul className="divide-y-2 divide-black border-2 border-black rounded-lg bg-white">
          {apps.map((app) => (
            <li key={app.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-black">{app.name}</p>
                <p className="text-sm text-gray-600">
                  {app.key_prefix}… · {new Date(app.created_at).toLocaleString()}
                  {app.revoked_at ? ' · Revoked' : ''}
                </p>
              </div>
              {!app.revoked_at && (
                confirmRevokeId === app.id ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void revoke(app.id)}
                      className="px-3 py-1.5 rounded-lg border-2 border-black bg-black text-white text-sm cursor-pointer"
                    >
                      Confirm revoke
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(null)}
                      className="px-3 py-1.5 rounded-lg border-2 border-black text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(app.id)}
                    className="px-3 py-1.5 rounded-lg border-2 border-black text-sm cursor-pointer"
                  >
                    Revoke
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
