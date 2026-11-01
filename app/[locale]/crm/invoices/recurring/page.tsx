'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface Schedule {
  id: string;
  customerName: string;
  frequency: string;
  next_run_date: string;
  end_date: string | null;
  is_active: boolean;
  amount_cents: number;
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function RecurringInvoicesPage() {
  const locale = useLocale();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/crm/invoices/recurring', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load schedules');
    setSchedules(data.schedules ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load schedules'))
      .finally(() => setLoading(false));
  }, [load]);

  const patch = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/crm/invoices/recurring/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not update the schedule');
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    setDeleting(true);
    const res = await fetch(`/api/crm/invoices/recurring/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setError(data.error || 'Could not delete the schedule');
      return;
    }
    setDeleteId(null);
    await load();
  };

  return (
    <div className="w-full">
      <Link href={`/${locale}/crm/invoices`} className="inline-flex items-center gap-2 text-gray-700 hover:text-black font-medium mb-4">
        <ArrowLeft className="w-5 h-5" />
        Back to Invoices
      </Link>
      <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Recurring invoices</h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-4">
        Schedules are created from an invoice with Repeat. A daily job creates the next invoice and emails it when the customer has an address.
      </p>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading schedules…</div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-gray-500">No schedules yet. Open an invoice and choose Repeat.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{schedule.customerName}</p>
                <p className="text-sm text-gray-500">
                  {money(schedule.amount_cents)} · {schedule.frequency} · next {schedule.next_run_date}
                  {schedule.end_date ? ` · ends ${schedule.end_date}` : ''}
                  {!schedule.is_active ? ' · paused' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => patch(schedule.id, !schedule.is_active)}>
                  {schedule.is_active ? 'Pause' : 'Resume'}
                </Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setDeleteId(schedule.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        isOpen={Boolean(deleteId)}
        onClose={() => !deleting && setDeleteId(null)}
        showHeader={false}
        showCloseButton
        maxWidth="sm"
        preventCloseOnOverlayClick={deleting}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Delete this schedule?</h2>
          <p className="text-sm text-gray-600 mb-4">Invoices already created stay. No further invoices will be generated.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={deleting} onClick={() => setDeleteId(null)}>Back</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting || !deleteId}
              onClick={() => deleteId && remove(deleteId)}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
