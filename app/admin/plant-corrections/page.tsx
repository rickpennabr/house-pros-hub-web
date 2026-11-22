'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';

interface Correction {
  id: string;
  photoUrl: string;
  wrongCommonName: string | null;
  wrongScientificName: string | null;
  correctCommonName: string;
  correctScientificName: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

/**
 * Plant ID training: every correction an admin made to a ProBot plant answer. Each active one is
 * used on every later identification (as a note, and as a reference photo when a new photo looks
 * like it). Turn one off or delete it if it was wrong.
 */
export default function PlantCorrectionsPage() {
  const [rows, setRows] = useState<Correction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; common: string; scientific: string; notes: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/plant-corrections', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not load corrections');
      setRows([]);
      return;
    }
    setError(null);
    setRows(data.corrections ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/plant-corrections', { credentials: 'include' })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) setError(typeof data.error === 'string' ? data.error : 'Could not load corrections');
        setRows(ok ? data.corrections ?? [] : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load corrections');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plant-corrections/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not save');
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this correction? Later plant IDs stop using it.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/plant-corrections/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Could not delete');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sprout className="h-6 w-6 text-red-500" />
          Plant ID training
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          When ProBot names a plant wrong, open its answer in the chat and tap <b>Wrong plant? Correct it</b>. Each active
          correction below is used on every later plant photo: as a note to the AI, and as a labeled reference photo when
          a new photo looks like it. Good notes on how to tell the plants apart help the most.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows === null ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {rows?.length === 0 && !error ? (
        <p className="text-sm text-gray-600">No corrections yet.</p>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(rows ?? []).map((row) => (
          <li key={row.id} className={`flex gap-3 rounded-lg border-2 p-3 text-sm ${row.active ? 'border-black' : 'border-gray-300 opacity-70'}`}>
            {/* Chat photos live on the public storage host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-lg border border-black object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              {editing?.id === row.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void patch(row.id, {
                      correctCommonName: editing.common,
                      correctScientificName: editing.scientific,
                      notes: editing.notes,
                    });
                  }}
                >
                  <input
                    value={editing.common}
                    onChange={(event) => setEditing({ ...editing, common: event.target.value })}
                    placeholder="Correct name"
                    className="w-full rounded-lg border-2 border-black px-2 py-1"
                    required
                  />
                  <input
                    value={editing.scientific}
                    onChange={(event) => setEditing({ ...editing, scientific: event.target.value })}
                    placeholder="Scientific name"
                    className="w-full rounded-lg border-2 border-black px-2 py-1 italic"
                  />
                  <textarea
                    value={editing.notes}
                    onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                    placeholder="How to tell it apart"
                    rows={3}
                    className="w-full rounded-lg border-2 border-black px-2 py-1"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busyId === row.id} className="rounded-lg bg-black px-3 py-1 text-white disabled:opacity-60">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg border-2 border-black px-3 py-1">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="font-semibold">
                    {row.correctCommonName}
                    {row.correctScientificName ? <i className="font-normal"> ({row.correctScientificName})</i> : null}
                  </p>
                  {row.wrongCommonName || row.wrongScientificName ? (
                    <p className="text-xs text-gray-600">
                      AI said: <s>{[row.wrongCommonName, row.wrongScientificName && `(${row.wrongScientificName})`].filter(Boolean).join(' ')}</s>
                    </p>
                  ) : null}
                  {row.notes ? <p className="text-xs">How to tell: {row.notes}</p> : null}
                  <p className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-3 pt-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          common: row.correctCommonName,
                          scientific: row.correctScientificName ?? '',
                          notes: row.notes ?? '',
                        })
                      }
                    >
                      Edit
                    </button>
                    <button type="button" disabled={busyId === row.id} onClick={() => void patch(row.id, { active: !row.active })}>
                      {row.active ? 'Turn off' : 'Turn on'}
                    </button>
                    <button type="button" disabled={busyId === row.id} onClick={() => void remove(row.id)} className="text-red-600">
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
