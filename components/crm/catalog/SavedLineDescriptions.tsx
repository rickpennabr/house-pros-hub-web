'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

interface Saved {
  id: string;
  description: string;
}

/**
 * The invoice and estimate descriptions saved for a service: offered as suggestions on each line.
 * New ones are also saved by themselves whenever a document with this service is saved.
 */
export function SavedLineDescriptions({ itemName }: { itemName: string }) {
  const [items, setItems] = useState<Saved[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = itemName.trim();

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/crm/line-descriptions?item=${encodeURIComponent(name)}`, { credentials: 'include' })
        .then((res) => res.json())
        .then((body: { descriptions?: Saved[]; setupError?: string }) => {
          if (cancelled) return;
          setItems(body.descriptions ?? []);
          setSetupError(body.setupError ?? null);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name]);

  const add = async () => {
    const text = draft.trim();
    if (!text || !name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/line-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item: name, description: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save');
      setItems((current) => [body.description as Saved, ...current.filter((row) => row.id !== body.description.id)]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/crm/line-descriptions?id=${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setItems((current) => current.filter((row) => row.id !== id));
  };

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">Invoice descriptions</span>
      <p className="mb-2 text-xs text-gray-500">
        On invoices and estimates this service starts with an empty description. These are offered as you type, and
        every new one you write there is saved here.
      </p>
      {!name ? (
        <p className="text-xs text-gray-500">Name the service first.</p>
      ) : setupError ? (
        <p className="rounded-lg border-2 border-black bg-amber-50 p-2 text-xs">{setupError}</p>
      ) : (
        <>
          {items.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {items.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{row.description}</span>
                  <button
                    type="button"
                    onClick={() => void remove(row.id)}
                    className="shrink-0 rounded-md p-0.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                    aria-label="Remove this description"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void add();
                }
              }}
              placeholder={`e.g. ${name} in the driveway`}
              className="min-w-0 flex-1 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !draft.trim()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-black px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </>
      )}
    </div>
  );
}
