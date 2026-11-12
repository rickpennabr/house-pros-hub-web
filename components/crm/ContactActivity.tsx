'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatAmount } from '@/lib/invoices/format';
import type { ContactTransaction } from '@/lib/crm/contact-books';

interface ContactActivityProps {
  customerId: string;
  locale: string;
}

interface ActivityResponse {
  openBalanceCents: number;
  overdueCents: number;
  transactions: ContactTransaction[];
}

const KIND_LABEL: Record<ContactTransaction['kind'], string> = {
  estimate: 'Estimate',
  invoice: 'Invoice',
  payment: 'Payment',
};

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ContactActivity({ customerId, locale }: ContactActivityProps) {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setError(null);
    fetch(`/api/crm/customers/${customerId}/activity`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((data as { error?: string }).error || 'Failed to load activity');
        return data as ActivityResponse;
      })
      .then((data) => {
        if (!cancelled) setActivity(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity');
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const openTransaction = (row: ContactTransaction) => {
    if (row.kind === 'estimate') {
      router.push(`/${locale}/crm/estimates?id=${row.recordId}`);
      return;
    }
    router.push(`/${locale}/crm/invoices/${row.recordId}`);
  };

  return (
    <div className="mb-3 overflow-hidden rounded-lg border-2 border-black bg-white">
      <div className="grid grid-cols-2">
        <div className="border-r-2 border-black px-3 py-2">
          <p className="text-xs text-gray-500">Open balance</p>
          <p className="text-lg font-semibold text-black">{formatAmount(activity?.openBalanceCents ?? 0)}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500">Overdue</p>
          <p className="text-lg font-semibold text-black">{formatAmount(activity?.overdueCents ?? 0)}</p>
        </div>
      </div>
      {error ? <p className="border-t-2 border-black px-3 py-3 text-sm text-red-700">{error}</p> : null}
      {!error && activity && activity.transactions.length === 0 ? (
        <p className="border-t-2 border-black px-3 py-3 text-sm text-gray-500">No invoices or estimates yet.</p>
      ) : null}
      {activity && activity.transactions.length > 0 ? (
        <ul className="border-t-2 border-black">
          {activity.transactions.map((row) => (
            <li key={row.id} className="border-t border-black first:border-t-0">
              <button
                type="button"
                onClick={() => openTransaction(row)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-black">
                    {KIND_LABEL[row.kind]} {row.number}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {formatDate(row.date)} · {titleCase(row.status)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-black">{formatAmount(row.amountCents)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
