'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Undo2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface Tool {
  id: string;
  name: string;
  category: string | null;
  status: string;
  projectId: string | null;
  projectName: string | null;
  assignedTo: string | null;
}

interface Rental {
  id: string;
  name: string;
  vendor: string | null;
  startDate: string;
  days: number | null;
  amountCents: number | null;
}

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Tools and equipment on a project. Owned items come from ProTools (their daily rate × days on the
 * job is charged in the Costs tab). Rentals are saved as "Equipment rental" expenses on the project.
 */
export function ProjectEquipment({ projectId, onCount }: { projectId: string; onCount?: (count: number) => void }) {
  const [onJob, setOnJob] = useState<Tool[]>([]);
  const [available, setAvailable] = useState<Tool[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const [rentalOpen, setRentalOpen] = useState(false);
  const [rentalName, setRentalName] = useState('');
  const [vendor, setVendor] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    try {
      const [mine, free, rented] = await Promise.all([
        fetch(`/api/crm/tools?projectId=${projectId}&pageSize=200`, { credentials: 'include', cache: 'no-store' }).then((res) => res.json()),
        fetch('/api/crm/tools?status=available&pageSize=200', { credentials: 'include', cache: 'no-store' }).then((res) => res.json()),
        fetch(`/api/crm/projects/${projectId}/rentals`, { credentials: 'include', cache: 'no-store' }).then((res) => res.json()),
      ]);
      const assigned: Tool[] = (mine.tools ?? []).filter((tool: Tool) => tool.projectId === projectId);
      setOnJob(assigned);
      setAvailable((free.tools ?? []).filter((tool: Tool) => !tool.projectId));
      setRentals(rented.rentals ?? []);
      setCanEdit(Boolean(mine.canEdit));
      if (mine.error) setError(mine.error);
      onCount?.(assigned.length + (rented.rentals ?? []).length);
    } catch {
      setError('Could not load tools and equipment');
    } finally {
      setLoading(false);
    }
  }, [projectId, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!pick) return;
    const ok = await call(`/api/crm/tools/${pick}`, 'PATCH', { checkout: true, projectId, maintenancePlanId: null, status: 'in_use' });
    if (ok) setPick('');
  };

  const addRental = async () => {
    const ok = await call(`/api/crm/projects/${projectId}/rentals`, 'POST', { name: rentalName, vendor, startDate, endDate, amount });
    if (ok) {
      setRentalOpen(false);
      setRentalName('');
      setVendor('');
      setAmount('');
    }
  };

  const rentalTotal = rentals.reduce((sum, rental) => sum + (rental.amountCents ?? 0), 0);

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-2">
        <h3 className="font-bold">Our tools on this job</h3>
        <p className="text-xs text-gray-600">From ProTools. Items with a daily rate are charged to the project for each day they are here (see Costs).</p>
        <div className="flex flex-wrap gap-2">
          <PickerSelect
            value={pick}
            onChange={setPick}
            className="min-w-[14rem] flex-1"
            aria-label="Tool to bring"
            placeholder={available.length ? 'Pick a tool or equipment…' : 'No available tools in ProTools'}
            disabled={!available.length}
            searchPlaceholder="Search tools"
            options={available.map((tool) => ({ value: tool.id, label: tool.name, detail: tool.category || null }))}
          />
          <Button type="button" size="sm" onClick={() => void assign()} disabled={busy || !pick}>
            <Wrench className="mr-1 h-4 w-4" /> Bring to job
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : onJob.length === 0 ? (
          <p className="text-sm text-gray-600">No tools assigned yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border-2 border-black bg-white">
            {onJob.map((tool) => (
              <li key={tool.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{tool.name}</span>
                  <span className="block text-xs text-gray-600">{[tool.category, tool.assignedTo ? `with ${tool.assignedTo}` : null].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void call(`/api/crm/tools/${tool.id}`, 'PATCH', { checkout: true, projectId: null, status: 'available' })}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md border-2 border-black px-2 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Returned
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">Rented equipment</h3>
          {canEdit ? (
            <Button type="button" size="sm" onClick={() => setRentalOpen((value) => !value)}>
              <Plus className="mr-1 h-4 w-4" /> Add rental
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-gray-600">Saved as an &quot;Equipment rental&quot; expense on this project, so it counts in project cost and company expenses once.</p>
        {rentalOpen ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border-2 border-black p-3 md:grid-cols-5">
            <label className="col-span-2 text-xs font-medium md:col-span-1">
              Equipment
              <Input value={rentalName} onChange={(e) => setRentalName(e.target.value)} placeholder="e.g. Mini Bobcat" className="mt-1" />
            </label>
            <label className="col-span-2 text-xs font-medium md:col-span-1">
              Rented from
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Sunbelt" className="mt-1" />
            </label>
            <label className="text-xs font-medium">
              Pickup
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </label>
            <label className="text-xs font-medium">
              Return
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </label>
            <label className="col-span-2 text-xs font-medium md:col-span-1">
              Total cost ($)
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1" />
            </label>
            <div className="col-span-2 flex justify-end gap-2 md:col-span-5">
              <Button type="button" size="sm" variant="secondary" onClick={() => setRentalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void addRental()} disabled={busy || !rentalName.trim() || !amount}>
                Save rental
              </Button>
            </div>
          </div>
        ) : null}
        {loading ? null : rentals.length === 0 ? (
          <p className="text-sm text-gray-600">No rentals on this job.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border-2 border-black bg-white">
            {rentals.map((rental) => (
              <li key={rental.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{rental.name}</span>
                  <span className="block text-xs text-gray-600">
                    {[rental.vendor, shortDate(rental.startDate), rental.days ? `${rental.days} day${rental.days === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {rental.amountCents != null ? <span className="font-medium tabular-nums">{money(rental.amountCents)}</span> : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove the ${rental.name} rental?`)) void call(`/api/crm/projects/${projectId}/rentals?rentalId=${rental.id}`, 'DELETE');
                      }}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${rental.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && rentals.length > 0 ? <p className="text-right text-sm font-medium">Rentals total: {money(rentalTotal)}</p> : null}
      </section>
    </div>
  );
}
