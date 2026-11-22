'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Check, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import type { AdminLeadPro } from '@/app/api/admin/estimates/pros/route';
import type { AdminEstimateAssignment } from '@/app/api/admin/estimates/route';

export const ASSIGNMENT_LABEL: Record<AdminEstimateAssignment['status'], string> = {
  offered: 'Waiting',
  accepted: 'Added to CRM',
  declined: 'Declined',
  cancelled: 'Taken back',
  expired: 'No answer',
};

export const ASSIGNMENT_CHIP: Record<AdminEstimateAssignment['status'], string> = {
  offered: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-200 text-gray-700',
};

/**
 * Admin: send a site estimate request to one pro. The pro gets an email and a ProBot card with the
 * job only; the customer's contact info unlocks when they tap Add to my CRM. Sending to a new pro
 * takes back an offer the previous pro has not answered.
 */
export function AssignLeadModal({
  estimate,
  onClose,
  onAssigned,
}: {
  estimate: { id: string; name: string; project: string; location: string; assignment: AdminEstimateAssignment | null } | null;
  onClose: () => void;
  onAssigned: (estimateId: string, assignment: AdminEstimateAssignment | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [pros, setPros] = useState<AdminLeadPro[] | null>(null);
  const [picked, setPicked] = useState<AdminLeadPro | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = Boolean(estimate);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/estimates/pros?q=${encodeURIComponent(query.trim())}`, { credentials: 'include', cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { pros?: AdminLeadPro[]; error?: string }) => {
          if (cancelled) return;
          if (data.error) setError(data.error);
          setPros(data.pros ?? []);
        })
        .catch(() => !cancelled && setError('Could not load pros.'));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function close() {
    if (busy) return;
    setQuery('');
    setPicked(null);
    setError(null);
    onClose();
  }

  async function send() {
    if (!estimate || !picked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/estimates/${estimate.id}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: picked.businessId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.assignment) throw new Error(typeof data.error === 'string' ? data.error : 'Could not send it.');
      onAssigned(estimate.id, data.assignment as AdminEstimateAssignment);
      setBusy(false);
      close();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not send it.');
    }
  }

  async function takeBack() {
    if (!estimate) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/estimates/${estimate.id}/assign`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError('Could not take it back.');
    onAssigned(estimate.id, estimate.assignment ? { ...estimate.assignment, status: 'cancelled' } : null);
    close();
  }

  const current = estimate?.assignment ?? null;

  return (
    <Modal isOpen={open} onClose={close} showHeader title="Assign to a pro" maxWidth="lg" contentClassName="p-0">
      {estimate ? (
        <div className="flex max-h-[75vh] flex-col">
          <div className="space-y-3 border-b-2 border-black p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-black">{estimate.name}</span>
              {estimate.project ? <> · <span className="capitalize">{estimate.project}</span></> : null}
              {estimate.location ? <> · {estimate.location}</> : null}
            </p>
            {current && current.status !== 'cancelled' ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-600">Sent to</span>
                <span className="font-semibold">{current.businessName}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ASSIGNMENT_CHIP[current.status]}`}>
                  {ASSIGNMENT_LABEL[current.status]}
                </span>
                {current.status === 'offered' ? (
                  <button type="button" disabled={busy} onClick={() => void takeBack()} className="text-xs font-medium text-red-600 underline">
                    Take back
                  </button>
                ) : null}
              </div>
            ) : null}
            <TypingSearchInput value={query} onChange={setQuery} placeholder="Search pros by business name…" clearLabel="Clear search" />
          </div>

          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
            {pros === null ? <li className="p-2 text-sm text-gray-500">Loading pros…</li> : null}
            {pros?.length === 0 ? <li className="p-2 text-sm text-gray-500">No pros match.</li> : null}
            {pros?.map((pro) => {
              const selected = picked?.businessId === pro.businessId;
              const isCurrent = current?.businessId === pro.businessId && current.status !== 'cancelled';
              return (
                <li key={pro.businessId}>
                  <button
                    type="button"
                    onClick={() => setPicked(pro)}
                    className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                      selected ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                      {pro.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote business logos
                        <img src={pro.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-500" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-semibold text-black">
                        <span className="truncate">{pro.name}</span>
                        {pro.verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-red-600" aria-label="Verified" /> : null}
                      </span>
                      <span className="block truncate text-xs capitalize text-gray-600">
                        {[pro.trades.slice(0, 3).join(', ').replaceAll('_', ' '), pro.phone].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    {isCurrent ? <span className="shrink-0 text-xs text-gray-500">Current</span> : null}
                    {selected ? <Check className="h-5 w-5 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 border-t-2 border-black p-4">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <p className="text-xs text-gray-600">
              The pro gets an email and a ProBot message with the job only. The customer&apos;s name, phone and email unlock when they tap
              Add to my CRM, and then the customer gets an email with the pro&apos;s contact.
              {current?.status === 'offered' ? ' Sending to a different pro takes it back from the current one.' : ''}
            </p>
            <button
              type="button"
              disabled={!picked || busy}
              onClick={() => void send()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy ? 'Sending…' : picked ? `Send to ${picked.name}` : 'Pick a pro'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
