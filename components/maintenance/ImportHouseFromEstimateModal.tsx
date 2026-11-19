'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileInput } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { AGREEMENT_KIND_LABELS, isAgreementKind, isMaintenanceFrequency, MAINTENANCE_FREQUENCY_LABELS } from '@/lib/crm/estimate-agreement';
import type { ImportableEstimate } from '@/app/api/crm/maintenance/houses/import/route';

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function estimateLine(row: ImportableEstimate) {
  const kind = isAgreementKind(row.agreementKind) ? AGREEMENT_KIND_LABELS[row.agreementKind] : row.agreementKind;
  const schedule = isMaintenanceFrequency(row.frequency) ? MAINTENANCE_FREQUENCY_LABELS[row.frequency] : null;
  return [`#${row.displayId}`, row.jobArea, kind, schedule, row.status, money(row.amountCents)].filter(Boolean).join(' · ');
}

/**
 * Pick an estimate and turn it into a maintenance house: same contact and property, its schedule
 * and price, and its note as the job.
 */
export function ImportHouseFromEstimateModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The new (or already existing) house. */
  onImported: (houseId: string) => void;
}) {
  const [loaded, setLoaded] = useState<ImportableEstimate[] | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; houseId?: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/crm/maintenance/houses/import', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load estimates');
        if (!cancelled) setLoaded(Array.isArray(data.estimates) ? data.estimates : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded([]);
          setError({ message: err instanceof Error ? err.message : 'Could not load estimates' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = loaded ?? [];
    return query
      ? list.filter((row) => `${row.customerName} ${estimateLine(row)}`.toLowerCase().includes(query))
      : list;
  }, [loaded, search]);

  const importEstimate = async (row: ImportableEstimate) => {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch('/api/crm/maintenance/houses/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: row.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.id !== 'string') {
        setError({
          message: data.error || 'Could not import the estimate',
          houseId: typeof data.houseId === 'string' ? data.houseId : undefined,
        });
        return;
      }
      onImported(data.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !busyId && onClose()} title="Import house from an estimate" maxWidth="lg">
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-600">
          Pick an estimate. The house gets its contact and property, schedule (monthly when the estimate has none),
          price, and its note as the job. No invoices are scheduled.
        </p>
        <TypingSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search contact, estimate number, or job…"
          clearLabel="Clear estimate search"
          className="relative w-full"
        />
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error.message}
            {error.houseId ? (
              <>
                {' '}
                <button type="button" className="font-semibold underline" onClick={() => onImported(error.houseId!)}>
                  Open that house
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {loaded === null ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading estimates…</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            {loaded.length === 0 ? 'No estimates to import. Every estimate already has a house, or was declined.' : 'No estimate matches.'}
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {visible.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-lg border-2 border-black p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.customerName}</div>
                  <div className="truncate text-xs text-gray-600">{estimateLine(row)}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void importEstimate(row)}
                  disabled={Boolean(busyId)}
                  className="inline-flex shrink-0 items-center gap-1"
                >
                  <FileInput className="h-4 w-4" />
                  {busyId === row.id ? 'Importing…' : 'Import'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
