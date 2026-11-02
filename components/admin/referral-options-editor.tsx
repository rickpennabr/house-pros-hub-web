'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { publishReferralOptions, type ExtraReferralOption } from '@/hooks/useReferralOptions';

export function ReferralOptionsEditor() {
  const [options, setOptions] = useState<ExtraReferralOption[]>([]);
  const [label, setLabel] = useState('');
  const [asksForName, setAsksForName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/referral-options', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load options');
      if (data.setupRequired) {
        setError('Referral options are not set up yet.');
      }
      const next = Array.isArray(data.options) ? (data.options as ExtraReferralOption[]) : [];
      setOptions(next);
      publishReferralOptions(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addOption = async (event: FormEvent) => {
    event.preventDefault();
    const nextLabel = label.trim();
    if (!nextLabel || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/referral-options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: nextLabel, asksForName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add option');
      const option = data.option as ExtraReferralOption;
      const next = [...options, option].sort((a, b) => a.sortOrder - b.sortOrder);
      setOptions(next);
      publishReferralOptions(next);
      setLabel('');
      setAsksForName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add option');
    } finally {
      setSaving(false);
    }
  };

  const removeOption = async (option: ExtraReferralOption) => {
    if (pendingRemoveId !== option.id) {
      setPendingRemoveId(option.id);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/referral-options/${option.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to remove option');
      const next = options.filter((item) => item.id !== option.id);
      setOptions(next);
      publishReferralOptions(next);
      setPendingRemoveId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove option');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-4 rounded-lg border-2 border-black bg-white p-4">
      <h2 className="text-sm font-semibold text-black">How did you hear about us</h2>
      <p className="mt-1 text-sm text-gray-600">
        Google, Instagram, Facebook, previous customer, friend, and Other stay on the list. Add more choices here. They show on signup.
      </p>
      <form onSubmit={addOption} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="New option"
            disabled={saving}
            maxLength={80}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-black whitespace-nowrap">
          <input
            type="checkbox"
            checked={asksForName}
            onChange={(event) => setAsksForName(event.target.checked)}
            disabled={saving}
            className="h-4 w-4 accent-black"
          />
          Ask for a name
        </label>
        <Button type="submit" size="sm" disabled={saving || !label.trim()}>
          Add
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading options…</p>
      ) : options.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <li key={option.id} className="flex items-center gap-1 rounded-full border-2 border-black px-3 py-1 text-sm">
              <span>
                {option.label}
                {option.asksForName ? ' · asks for a name' : ''}
              </span>
              <button
                type="button"
                onClick={() => void removeOption(option)}
                disabled={saving}
                className="ml-1 inline-flex items-center text-gray-600 hover:text-black cursor-pointer disabled:opacity-50"
                aria-label={pendingRemoveId === option.id ? `Confirm remove ${option.label}` : `Remove ${option.label}`}
              >
                {pendingRemoveId === option.id ? <span className="text-xs font-medium">Remove</span> : <X className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
