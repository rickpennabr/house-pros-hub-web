'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';
import type { PendingPro, PlaceCard } from '@/lib/places/portal';

const DISMISSED_KEY = 'hph:pendingProsDismissed';

function readDismissed(): string[] {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Not saved: the card comes back on the next visit, which is fine.
  }
}

/**
 * Pros that have this customer in their CRM. Nothing of theirs shows on a place until the
 * customer picks which place it belongs to here.
 */
export function PendingProsCard({ pros, places }: { pros: PendingPro[]; places: PlaceCard[] }) {
  const t = useTranslations('places');
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readDismissed()));
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const visible = pros.filter((pro) => !dismissed.includes(pro.ownerId) && !done.includes(pro.ownerId));
  if (visible.length === 0 && !added) return null;

  const approve = async (pro: PendingPro, place: PlaceCard) => {
    setBusy(`${pro.ownerId}:${place.id}`);
    setError(null);
    setAdded(null);
    try {
      const res = await fetch('/api/places/pending-pros', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: pro.ownerId, placeId: place.id }),
      });
      if (!res.ok) throw new Error('failed');
      setDone((current) => [...current, pro.ownerId]);
      setAdded(t('pendingProAdded', { pro: pro.businessName, place: place.name }));
    } catch {
      setError(t('pendingProFailed'));
    } finally {
      setBusy(null);
    }
  };

  const notNow = (pro: PendingPro) => {
    const next = [...dismissed, pro.ownerId];
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <div className="space-y-2">
      {added ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {added}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      {visible.map((pro) => (
        <div key={pro.ownerId} className="rounded-lg border-2 border-black bg-white p-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
              {pro.businessLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- business logo URL from storage
                <img src={pro.businessLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-5 w-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{t('pendingProTitle', { pro: pro.businessName })}</p>
              <p className="text-xs text-gray-600">
                {places.length > 0 ? t('pendingProBody') : t('pendingProNoPlaces', { pro: pro.businessName })}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {places.map((place) => (
              <button
                key={place.id}
                type="button"
                disabled={busy !== null}
                onClick={() => approve(pro, place)}
                className="rounded-full border-2 border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {busy === `${pro.ownerId}:${place.id}` ? t('pendingProAdding') : t('pendingProAddTo', { place: place.name })}
              </button>
            ))}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => notNow(pro)}
              className="rounded-full border-2 border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-500 disabled:opacity-60"
            >
              {t('pendingProNotNow')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
